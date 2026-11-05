import { Subscription } from 'rxjs';
import { CacheService } from '../cache/cache.service';
import { configStub, query } from '../test-utils';
import { AnalyticsService } from './analytics.service';

const OID = (n: number) => n.toString(16).padStart(24, '0');

describe('AnalyticsService', () => {
  let events: Record<string, jest.Mock>;
  let links: Record<string, jest.Mock>;
  let users: Record<string, jest.Mock>;
  let cache: CacheService;
  let service: AnalyticsService;
  let subs: Subscription[];
  // streams carry a 25 s keep-alive timer: always unsubscribe so Jest can exit
  const listen = (svc: AnalyticsService, userId: string, into: any[]) =>
    subs.push(svc.stream(userId).subscribe((e) => into.push(e)));

  afterEach(() => subs.forEach((s) => s.unsubscribe()));

  beforeEach(() => {
    subs = [];
    events = { create: jest.fn().mockResolvedValue({}), aggregate: jest.fn() };
    links = { findOne: jest.fn(), find: jest.fn() };
    users = { findById: jest.fn(), findOne: jest.fn() };
    cache = new CacheService(configStub());
    service = new AnalyticsService(events as any, links as any, users as any, cache);
  });

  describe('trackView', () => {
    it('records a view of a user found by @username', async () => {
      users.findOne.mockReturnValue(query({ _id: OID(1) }));
      await expect(service.trackView('1.1.1.1', '@Maria')).resolves.toEqual({ ok: true });
      expect(users.findOne).toHaveBeenCalledWith({ username: 'maria' });
      expect(events.create).toHaveBeenCalledWith({ userId: OID(1), type: 'view' });
    });

    it('records a view of a user found by id', async () => {
      users.findById.mockReturnValue(query({ _id: OID(1) }));
      await service.trackView('1.1.1.1', OID(1));
      expect(users.findById).toHaveBeenCalledWith(OID(1));
      expect(events.create).toHaveBeenCalledTimes(1);
    });

    it('never fails for an unknown page (tracking must not break the public page)', async () => {
      users.findOne.mockReturnValue(query(null));
      await expect(service.trackView('1.1.1.1', 'ninguem')).resolves.toEqual({ ok: true });
      expect(events.create).not.toHaveBeenCalled();
    });

    it('counts the same visitor once inside the window, but another visitor separately', async () => {
      users.findOne.mockReturnValue(query({ _id: OID(1) }));
      await service.trackView('1.1.1.1', 'maria');
      await service.trackView('1.1.1.1', 'maria');
      await service.trackView('2.2.2.2', 'maria');
      expect(events.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('trackClick', () => {
    it('records a click on an active link, attributed to the link owner', async () => {
      links.findOne.mockReturnValue(query({ _id: OID(9), userId: OID(1) }));
      await service.trackClick('1.1.1.1', OID(9));
      expect(links.findOne).toHaveBeenCalledWith({ _id: OID(9), isActivit: true });
      expect(events.create).toHaveBeenCalledWith({ userId: OID(1), type: 'click', linkId: OID(9) });
    });

    it('ignores malformed ids, inactive/unknown links and quick repeats', async () => {
      await service.trackClick('1.1.1.1', 'xxx');
      expect(links.findOne).not.toHaveBeenCalled();

      links.findOne.mockReturnValue(query(null));
      await service.trackClick('1.1.1.1', OID(9));
      expect(events.create).not.toHaveBeenCalled();

      links.findOne.mockReturnValue(query({ _id: OID(9), userId: OID(1) }));
      await service.trackClick('1.1.1.1', OID(9));
      await service.trackClick('1.1.1.1', OID(9));
      expect(events.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('stream (live feed)', () => {
    it('delivers each user\'s events only to that user', async () => {
      users.findOne.mockImplementation((q: any) => query({ _id: q.username === 'ana' ? OID(1) : OID(2) }));
      const ana: any[] = [];
      const bia: any[] = [];
      listen(service, OID(1), ana);
      listen(service, OID(2), bia);

      await service.trackView('1.1.1.1', 'ana');
      await service.trackView('1.1.1.1', 'bia');

      expect(ana.filter((e) => e.type !== 'ping')).toHaveLength(1);
      expect(ana[0].type).toBe('view');
      expect(bia.filter((e) => e.type !== 'ping')).toHaveLength(1);
    });

    it('reaches a stream opened on ANOTHER instance sharing the same bus', async () => {
      // two services, one shared cache = two API instances behind Redis
      const other = new AnalyticsService(events as any, links as any, users as any, cache);
      users.findOne.mockReturnValue(query({ _id: OID(1) }));
      const seenByOther: any[] = [];
      listen(other, OID(1), seenByOther);

      await service.trackView('1.1.1.1', 'ana');

      expect(seenByOther.map((e) => e.type)).toEqual(['view']);
    });

    it('does not emit for a view that was deduplicated', async () => {
      users.findOne.mockReturnValue(query({ _id: OID(1) }));
      const got: any[] = [];
      listen(service, OID(1), got);
      await service.trackView('1.1.1.1', 'ana');
      await service.trackView('1.1.1.1', 'ana');
      expect(got).toHaveLength(1);
    });
  });

  describe('summary', () => {
    const today = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

    it('fills the empty days, totals views/clicks and computes the click rate', async () => {
      events.aggregate
        .mockResolvedValueOnce([
          { _id: { day: today, type: 'view' }, n: 8 },
          { _id: { day: today, type: 'click' }, n: 2 },
        ])
        .mockResolvedValueOnce([{ _id: OID(9), n: 2 }]);
      links.find.mockReturnValue(query([
        { _id: OID(9), name: 'Site', type: 'Link' },
        { _id: OID(8), name: 'Seção', type: 'Cabecalho' },
        { _id: OID(7), name: 'Zap', type: 'Whatsapp' },
      ]));

      const s = await service.summary(OID(1), 7);

      expect(s.daily).toHaveLength(7);
      expect(s.daily[6]).toEqual({ day: today, views: 8, clicks: 2 });
      expect(s.daily.slice(0, 6).every((d) => d.views === 0 && d.clicks === 0)).toBe(true);
      expect([s.views, s.clicks, s.ctr]).toEqual([8, 2, 25]);
      expect(s.links).toEqual([
        { id: OID(9), name: 'Site', clicks: 2 },
        { id: OID(7), name: 'Zap', clicks: 0 }, // headers are not listed; sorted by clicks
      ]);
    });

    it('has a 0% rate with no views (no division by zero)', async () => {
      events.aggregate.mockResolvedValue([]);
      links.find.mockReturnValue(query([]));
      const s = await service.summary(OID(1), 30);
      expect([s.views, s.clicks, s.ctr]).toEqual([0, 0, 0]);
      expect(s.daily).toHaveLength(30);
    });

    it('scopes every query to the requesting user', async () => {
      events.aggregate.mockResolvedValue([]);
      links.find.mockReturnValue(query([]));
      await service.summary(OID(1), 7);
      for (const [pipeline] of events.aggregate.mock.calls) {
        expect(String(pipeline[0].$match.userId)).toBe(OID(1));
      }
      expect(String(links.find.mock.calls[0][0].userId)).toBe(OID(1));
    });
  });
});
