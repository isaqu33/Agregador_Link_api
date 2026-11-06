// Integration test: the real AppModule against a real MongoDB (Testcontainers). Needs Docker.
// Run with `npm run test:int`.
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  MongoDBContainer,
  StartedMongoDBContainer,
} from '@testcontainers/mongodb';
import * as request from 'supertest';

describe('API (integration, real MongoDB)', () => {
  let mongo: StartedMongoDBContainer;
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    mongo = await new MongoDBContainer('mongo:7').start();
    process.env.DATABASE_URL = `${mongo.getConnectionString()}/facelink_test?directConnection=true`;
    process.env.SECRET_JWT = 'integration-test-secret';
    process.env.NODE_ENV = 'test';
    process.env.AZURE_STORAGE_CONNECTION_STRING = 'UseDevelopmentStorage=true';
    delete process.env.REDIS_URL;

    // imported after the env is set because ConfigModule reads it at load time
    const { AppModule } = await import('../src/app.module');
    // Azure Blob is out of scope here: replace it so the app does not try to reach Azurite
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
  });

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  it('readiness reports Mongo connected', async () => {
    const res = await http.get('/health/ready').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', mongo: true });
  });

  it('removed the sample routes', async () => {
    await http.get('/').expect(404);
    await http.get('/texte').expect(404);
  });

  it('register -> login -> create link -> public page, and the password hash never leaks', async () => {
    const creds = {
      name: 'Maria',
      email: 'maria@example.com',
      password: 'senha-forte-123',
    };
    await http.post('/auth/register').send(creds).expect(201);
    const login = await http
      .post('/auth/login')
      .send({ email: creds.email, password: creds.password })
      .expect(200);
    const token: string = login.body.accessToken;
    expect(token).toBeTruthy();
    const auth = { Authorization: `Bearer ${token}` };

    // bad input is rejected by validation
    await http
      .post('/links/addLink')
      .set(auth)
      .send({ name: 'x', type: 'Nope' })
      .expect(400);
    // javascript: URLs never get in
    await http
      .post('/links/addLink')
      .set(auth)
      .send({ name: 'xss', type: 'Link', link: 'javascript:alert(1)' })
      .expect(400);

    const created = await http
      .post('/links/addLink')
      .set(auth)
      .send({
        name: 'Meu site',
        type: 'Link',
        link: 'https://example.com',
        password: 'segredo-123',
      })
      .expect(201);
    expect(JSON.stringify(created.body)).not.toMatch(
      /passwordHash|segredo-123/,
    );

    const me = await http.get('/user/me').set(auth).expect(200);
    const id = me.body.id ?? me.body._id;
    const pub = await http.get(`/links/getDataUser/${id}`).expect(200);
    const link = pub.body.links.find((l) => l.name === 'Meu site');
    expect(link).toBeDefined();
    // the real destination of a locked link is not in the public JSON
    expect(JSON.stringify(pub.body)).not.toContain('example.com');
  });

  it('rejects private routes without a token', async () => {
    await http.get('/user/me').expect(401);
  });
});
