import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { interval, merge, Observable, Subject } from 'rxjs';
import { CacheService } from '../cache/cache.service';
import { filter, map } from 'rxjs/operators';
import { toCsv } from '../common/csv';
import { Device, deviceFromUserAgent, referrerHost } from '../common/visitor';
import { Link, LinkDocument } from '../links/schemas/link.schema';
import { Page, PageDocument } from '../pages/schemas/page.schema';
import { User, UserDocument } from '../user/schemas/user.schema';
import { Event, EventDocument } from './schemas/event.schema';

const TZ = 'America/Sao_Paulo';
// same visitor + same target inside this window counts once (refresh/double click)
const THROTTLE_SECONDS = 3;
const CHANNEL = 'analytics:live';

export interface LiveEvent {
  userId: string;
  type: 'view' | 'click';
  linkId?: string;
  pageId?: string | null;
  at: string;
}

const pageFilter = (pageId?: string) =>
  pageId && isValidObjectId(pageId) ? new Types.ObjectId(pageId) : null;

@Injectable()
export class AnalyticsService {
  // live feed for SSE: events travel through the cache (Redis when configured), so every API
  // instance sees the views/clicks recorded by any other one
  private live = new Subject<LiveEvent>();

  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    @InjectModel(Link.name) private linkModel: Model<LinkDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Page.name) private pageModel: Model<PageDocument>,
    private cache: CacheService,
  ) {
    this.cache.subscribe(CHANNEL, (message) => {
      try {
        this.live.next(JSON.parse(message) as LiveEvent);
      } catch {
        // ignore malformed messages
      }
    });
  }

  // same visitor + same target inside the window counts once (refresh / double click)
  private async seenRecently(key: string) {
    return (await this.cache.incr(`dedupe:${key}`, THROTTLE_SECONDS)) > 1;
  }

  private emit(event: LiveEvent) {
    return this.cache.publish(CHANNEL, JSON.stringify(event));
  }

  // Never throws for unknown targets: tracking must not break the public page.
  // `profile` is a user/page id or @username; the owner of the page gets the event.
  async trackView(visitor: string, profile: string, userAgent?: string, referrer?: string) {
    const handle = profile.replace(/^@/, '').toLowerCase();
    const target = isValidObjectId(profile)
      ? (await this.userModel.findById(profile).select('_id').then((u) => u && { owner: u._id, page: null })) ||
        (await this.pageModel.findById(profile).select('userId').then((p) => p && { owner: p.userId, page: p._id }))
      : (await this.userModel.findOne({ username: handle }).select('_id').then((u) => u && { owner: u._id, page: null })) ||
        (await this.pageModel.findOne({ username: handle }).select('userId').then((p) => p && { owner: p.userId, page: p._id }));
    if (!target || (await this.seenRecently(`v|${visitor}|${target.owner}|${target.page ?? ''}`))) {
      return { ok: true };
    }

    await this.eventModel.create({
      userId: target.owner,
      pageId: target.page,
      type: 'view',
      device: deviceFromUserAgent(userAgent),
      referrer: referrerHost(referrer),
    });
    await this.emit({
      userId: String(target.owner),
      pageId: target.page ? String(target.page) : null,
      type: 'view',
      at: new Date().toISOString(),
    });
    return { ok: true };
  }

  async trackClick(visitor: string, linkId: string) {
    if (!isValidObjectId(linkId)) return { ok: true };
    const link = await this.linkModel
      .findOne({ _id: linkId, isActivit: true })
      .select('userId pageId');
    if (!link || (await this.seenRecently(`c|${visitor}|${linkId}`))) {
      return { ok: true };
    }

    await this.eventModel.create({
      userId: link.userId,
      pageId: link.pageId ?? null,
      type: 'click',
      linkId: link._id,
    });
    await this.emit({
      userId: String(link.userId),
      pageId: link.pageId ? String(link.pageId) : null,
      type: 'click',
      linkId: String(link._id),
      at: new Date().toISOString(),
    });
    return { ok: true };
  }

  // Server-sent events for one user: every view/click of their page, plus a ping to keep proxies from closing the stream.
  stream(userId: string): Observable<{ type: string; data: object }> {
    const events = this.live.pipe(
      filter((e) => e.userId === userId),
      map((e) => ({ type: e.type, data: { linkId: e.linkId, pageId: e.pageId ?? null, at: e.at } })),
    );
    const ping = interval(25000).pipe(map(() => ({ type: 'ping', data: {} })));
    return merge(events, ping);
  }

  async summary(userId: string, days: number, pageId?: string) {
    const since = startOfDay(daysAgo(days - 1));
    const uid = new Types.ObjectId(userId);
    const page = pageFilter(pageId);

    const [perDay, perLink, links, perDevice, perReferrer] = await Promise.all([
      this.eventModel.aggregate([
        { $match: { userId: uid, pageId: page, createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } },
              type: '$type',
            },
            n: { $sum: 1 },
          },
        },
      ]),
      this.eventModel.aggregate([
        { $match: { userId: uid, pageId: page, type: 'click', createdAt: { $gte: since } } },
        { $group: { _id: '$linkId', n: { $sum: 1 } } },
      ]),
      this.linkModel.find({ userId: uid, pageId: page }).select('name type').sort({ order: 1, _id: 1 }),
      this.eventModel.aggregate([
        { $match: { userId: uid, pageId: page, type: 'view', createdAt: { $gte: since } } },
        { $group: { _id: { $ifNull: ['$device', 'desconhecido'] }, n: { $sum: 1 } } },
        { $sort: { n: -1 } },
      ]),
      this.eventModel.aggregate([
        { $match: { userId: uid, pageId: page, type: 'view', createdAt: { $gte: since } } },
        { $group: { _id: { $ifNull: ['$referrer', 'direto'] }, n: { $sum: 1 } } },
        { $sort: { n: -1 } },
        { $limit: 8 },
      ]),
    ]);

    const byDay = new Map<string, { views: number; clicks: number }>();
    for (let i = days - 1; i >= 0; i--) {
      byDay.set(dayKey(daysAgo(i)), { views: 0, clicks: 0 });
    }
    let views = 0;
    let clicks = 0;
    for (const row of perDay) {
      const slot = byDay.get(row._id.day);
      if (!slot) continue;
      if (row._id.type === 'view') {
        slot.views += row.n;
        views += row.n;
      } else {
        slot.clicks += row.n;
        clicks += row.n;
      }
    }

    const clicksByLink = new Map(perLink.map((r) => [String(r._id), r.n as number]));
    return {
      days,
      views,
      clicks,
      ctr: views > 0 ? Math.round((clicks / views) * 1000) / 10 : 0,
      daily: [...byDay].map(([day, v]) => ({ day, ...v })),
      devices: perDevice.map((r) => ({ device: r._id as string, views: r.n as number })),
      referrers: perReferrer.map((r) => ({ host: r._id as string, views: r.n as number })),
      links: links
        .filter((l) => l.type !== 'Cabecalho')
        .map((l) => ({ id: String(l._id), name: l.name, clicks: clicksByLink.get(String(l._id)) ?? 0 }))
        .sort((a, b) => b.clicks - a.clicks),
    };
  }

  // CSV of the numbers shown in the panel: per day, or clicks per link.
  async exportCsv(userId: string, days: number, kind: 'daily' | 'links', pageId?: string) {
    const s = await this.summary(userId, days, pageId);
    return kind === 'links'
      ? toCsv(['link', 'cliques'], s.links.map((l) => [l.name, l.clicks]))
      : toCsv(['dia', 'visitas', 'cliques'], s.daily.map((d) => [d.day, d.views, d.clicks]));
  }
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function startOfDay(date: Date) {
  // midnight in São Paulo (UTC-3, no DST since 2019)
  const d = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() + 3 * 60 * 60 * 1000);
}

function dayKey(date: Date) {
  return new Date(date.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
