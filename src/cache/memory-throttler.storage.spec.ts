import { MemoryThrottlerStorage } from './memory-throttler.storage';

describe('MemoryThrottlerStorage.hit', () => {
  let now: jest.SpyInstance;
  // moves the clock the storage reads (Date.now) without fake timers
  const at = (iso: string) => {
    now?.mockRestore();
    now = jest.spyOn(Date, 'now').mockReturnValue(new Date(iso).getTime());
  };

  it('lets exactly `limit` of 100 simultaneous hits through', async () => {
    const storage = new MemoryThrottlerStorage();
    const results = await Promise.all(
      Array.from({ length: 100 }, () => storage.hit('k', 60, 10)),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(10);
    expect(results.filter((r) => !r.allowed)).toHaveLength(90);
  });

  it('keys are independent', async () => {
    const storage = new MemoryThrottlerStorage();
    await storage.hit('a', 60, 1);
    expect((await storage.hit('a', 60, 1)).allowed).toBe(false);
    expect((await storage.hit('b', 60, 1)).allowed).toBe(true);
  });

  it('the window slides: old hits stop counting', async () => {
    at('2026-01-01T00:00:00Z');
    const storage = new MemoryThrottlerStorage();
    await storage.hit('k', 10, 2);
    at('2026-01-01T00:00:05Z');
    await storage.hit('k', 10, 2);
    expect((await storage.hit('k', 10, 2)).allowed).toBe(false);

    at('2026-01-01T00:00:11Z'); // first hit expired, second still counts
    const res = await storage.hit('k', 10, 2);
    expect(res).toMatchObject({ allowed: true, count: 2 });
    now.mockRestore();
  });

  it('reports how long to wait when blocked', async () => {
    at('2026-01-01T00:00:00Z');
    const storage = new MemoryThrottlerStorage();
    await storage.hit('k', 30, 1);
    at('2026-01-01T00:00:10Z');
    const blocked = await storage.hit('k', 30, 1);
    expect(blocked).toMatchObject({ allowed: false, retryAfter: 20 });
    now.mockRestore();
  });
});
