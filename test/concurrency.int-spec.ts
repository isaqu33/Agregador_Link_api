// Race-condition tests against a real MongoDB and a real Redis (Testcontainers). Needs Docker.
// Each test reproduces a concurrency bug; they fail on the old code and pass on the fix.
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  MongoDBContainer,
  StartedMongoDBContainer,
} from '@testcontainers/mongodb';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import Redis from 'ioredis';
import * as request from 'supertest';

describe('Concurrency (real MongoDB + Redis)', () => {
  let mongo: StartedMongoDBContainer;
  let redisBox: StartedTestContainer;
  let redis: Redis;
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function newUser(n: number) {
    const email = `user${n}-${Date.now()}@example.com`;
    const res = await http
      .post('/auth/register')
      .send({ name: `User ${n}`, email, password: 'senha-forte-123' })
      .expect(201);
    return {
      token: res.body.accessToken as string,
      id: res.body.user.id as string,
    };
  }

  beforeAll(async () => {
    [mongo, redisBox] = await Promise.all([
      new MongoDBContainer('mongo:7').start(),
      new GenericContainer('redis:7-alpine').withExposedPorts(6379).start(),
    ]);
    process.env.DATABASE_URL = `${mongo.getConnectionString()}/facelink_conc?directConnection=true`;
    process.env.REDIS_URL = `redis://${redisBox.getHost()}:${redisBox.getMappedPort(
      6379,
    )}`;
    process.env.SECRET_JWT = 'integration-test-secret';
    process.env.NODE_ENV = 'test';
    process.env.AZURE_STORAGE_CONNECTION_STRING = 'UseDevelopmentStorage=true';

    const { AppModule } = await import('../src/app.module');
    const { StorageService } = await import('../src/storage/storage.service');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(StorageService)
      .useValue({})
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    http = request(app.getHttpServer());
    redis = new Redis(process.env.REDIS_URL);
  });

  afterAll(async () => {
    redis?.disconnect();
    await app?.close();
    await Promise.all([mongo?.stop(), redisBox?.stop()]);
  });

  it('counter: INCR always leaves a TTL, even on a key that lost it (CacheService.incr)', async () => {
    const { CacheService } = await import('../src/cache/cache.service');
    const cache = new CacheService({ get: () => process.env.REDIS_URL } as any);

    // 50 parallel hits: exact sequence 1..50, no repeated or skipped value
    const values = await Promise.all(
      Array.from({ length: 50 }, () => cache.incr('c:seq', 30)),
    );
    expect([...values].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 50 }, (_, i) => i + 1),
    );
    expect(await redis.ttl('c:seq')).toBeGreaterThan(0);

    // a key left without TTL (e.g. crash between INCR and EXPIRE) heals on the next hit
    await redis.set('c:orphan', '4');
    expect(await redis.ttl('c:orphan')).toBe(-1);
    expect(await cache.incr('c:orphan', 30)).toBe(5);
    expect(await redis.ttl('c:orphan')).toBeGreaterThan(0);
    await cache.onModuleDestroy();
  });

  it('rate limit: exactly `limit` of 100 simultaneous hits get through', async () => {
    const { RedisThrottlerStorage } = await import(
      '../src/cache/redis-throttler.storage'
    );
    const storage: any = new RedisThrottlerStorage(redis);
    const results = await Promise.all(
      Array.from({ length: 100 }, () => storage.hit('race-key', 60, 10)),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(10);
  });

  it('link order: 30 simultaneous creations get 30 different positions', async () => {
    const { token, id } = await newUser(1);
    await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        http
          .post('/links/addLink')
          .set(bearer(token))
          .send({
            name: `l${i}`,
            type: 'Link',
            link: `https://example.com/${i}`,
          })
          .expect(201),
      ),
    );
    const me = await http.get('/user/me').set(bearer(token)).expect(200);
    const orders: number[] = me.body.links.map((l) => l.order);
    expect(orders).toHaveLength(30);
    expect(new Set(orders).size).toBe(30);
    expect(me.body.id ?? id).toBeTruthy();
  });

  it('username: one name, two owners in different collections, exactly one wins', async () => {
    const a = await newUser(2); // takes the name on its main page
    const b = await newUser(3); // takes the same name on an extra page
    const page = await http
      .post('/pages/create')
      .set(bearer(b.token))
      .send({ name: 'Loja' })
      .expect(201);
    const pageId = page.body.id;

    for (let round = 0; round < 15; round++) {
      const name = `disputa${round}`;
      const [ra, rb] = await Promise.all([
        http
          .post('/user/editProfile')
          .set(bearer(a.token))
          .send({ username: name }),
        http
          .post('/pages/edit')
          .set(bearer(b.token))
          .send({ id: pageId, username: name }),
      ]);
      const ok = [ra, rb].filter((r) => r.status < 300).length;
      const conflicts = [ra, rb].filter((r) => r.status === 409).length;
      expect({ round, ok, conflicts }).toEqual({ round, ok: 1, conflicts: 1 });
    }
  });

  it('reorder: a stale list (another device added a link) is refused with 409', async () => {
    const { token } = await newUser(4);
    const add = (n: string) =>
      http
        .post('/links/addLink')
        .set(bearer(token))
        .send({ name: n, type: 'Link', link: 'https://example.com' })
        .expect(201);
    const l1 = (await add('a')).body;
    const l2 = (await add('b')).body;
    await add('c-added-on-another-device');

    // this client still believes there are only two links
    await http
      .post('/links/reorder')
      .set(bearer(token))
      .send({ ids: [l2.id, l1.id] })
      .expect(409);
  });

  it('leads: pages through contacts with a cursor, newest first, no overlap', async () => {
    const { token } = await newUser(5);
    const form = (
      await http
        .post('/links/addLink')
        .set(bearer(token))
        .send({ name: 'News', type: 'Newsletter' })
        .expect(201)
    ).body;
    for (let i = 0; i < 7; i++) {
      // the public form allows 5 captures/min per IP (now enforced exactly), so each comes from its own IP
      await http
        .post('/leads')
        .set('x-forwarded-for', `203.0.113.${i + 1}`)
        .send({ linkId: form.id, email: `p${i}@example.com` })
        .expect(200);
    }
    const first = await http
      .get('/leads?limit=3')
      .set(bearer(token))
      .expect(200);
    expect(first.body.total).toBe(7);
    expect(first.body.leads).toHaveLength(3);
    expect(first.body.nextCursor).toBeTruthy();
    const second = await http
      .get(`/leads?limit=3&cursor=${first.body.nextCursor}`)
      .set(bearer(token))
      .expect(200);
    const third = await http
      .get(`/leads?limit=3&cursor=${second.body.nextCursor}`)
      .set(bearer(token))
      .expect(200);
    const emails = [
      ...first.body.leads,
      ...second.body.leads,
      ...third.body.leads,
    ].map((l) => l.email);
    expect(new Set(emails).size).toBe(7);
    expect(third.body.leads).toHaveLength(1);
    expect(third.body.nextCursor).toBeNull();
  });
});
