import { configStub } from '../test-utils';
import { CacheService } from './cache.service';

describe('CacheService (in-memory)', () => {
  let cache: CacheService;
  let now: number;

  beforeEach(() => {
    cache = new CacheService(configStub());
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });
  afterEach(() => jest.restoreAllMocks());

  it('counts hits and expires after the ttl', async () => {
    expect(await cache.incr('k', 10)).toBe(1);
    expect(await cache.incr('k', 10)).toBe(2);
    expect(await cache.count('k')).toBe(2);

    now += 10_001;
    expect(await cache.count('k')).toBe(0);
    expect(await cache.incr('k', 10)).toBe(1);
  });

  it('does not extend the window on later hits', async () => {
    await cache.incr('k', 10);
    now += 6_000;
    await cache.incr('k', 10);
    now += 5_000; // 11 s after the first hit
    expect(await cache.count('k')).toBe(0);
  });

  it('reset clears a counter', async () => {
    await cache.incr('k', 60);
    await cache.reset('k');
    expect(await cache.count('k')).toBe(0);
  });

  it('delivers published messages to subscribers of that channel only', async () => {
    const a: string[] = [];
    const b: string[] = [];
    cache.subscribe('one', (m) => a.push(m));
    cache.subscribe('two', (m) => b.push(m));

    await cache.publish('one', 'hello');

    expect(a).toEqual(['hello']);
    expect(b).toEqual([]);
  });
});
