import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { interval, merge, Observable, Subject } from 'rxjs';
import { CacheService } from '../cache/cache.service';
import { filter, map } from 'rxjs/operators';
import { Link, LinkDocument } from '../links/schemas/link.schema';
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
  at: string;
}

@Injectable()
export class AnalyticsService {
  // live feed for SSE: events travel through the cache (Redis when configured), so every API
  // instance sees the views/clicks recorded by any other one
  private live = new Subject<LiveEvent>();

  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    @InjectModel(Link.name) private linkModel: Model<LinkDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
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
  async trackView(visitor: string, profile: string) {
    const handle = profile.replace(/^@/, '').toLowerCase();
    const user = isValidObjectId(profile)
      ? await this.userModel.findById(profile).select('_id')
      : await this.userModel.findOne({ username: handle }).select('_id');
    if (!user || (await this.seenRecently(`v|${visitor}|${user._id}`))) {
      return { ok: true };
    }

    await this.eventModel.create({ userId: user._id, type: 'view' });
    await this.emit({ userId: String(user._id), type: 'view', at: new Date().toISOString() });
    return { ok: true };
  }

  async trackClick(visitor: string, linkId: string) {
    if (!isValidObjectId(linkId)) return { ok: true };
    const link = await this.linkModel.findOne({ _id: linkId, isActivit: true }).select('userId');
    if (!link || (await this.seenRecently(`c|${visitor}|${linkId}`))) {
      return { ok: true };
    }

    await this.eventModel.create({ userId: link.userId, type: 'click', linkId: link._id });
    await this.emit({
      userId: String(link.userId),
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
      map((e) => ({ type: e.type, data: { linkId: e.linkId, at: e.at } })),
    );
    const ping = interval(25000).pipe(map(() => ({ type: 'ping', data: {} })));
    return merge(events, ping);
  }

  async summary(userId: string, days: number) {
    const since = startOfDay(daysAgo(days - 1));
    const uid = new Types.ObjectId(userId);

    const [perDay, perLink, links] = await Promise.all([
      this.eventModel.aggregate([
        { $match: { userId: uid, createdAt: { $gte: since } } },
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
        { $match: { userId: uid, type: 'click', createdAt: { $gte: since } } },
        { $group: { _id: '$linkId', n: { $sum: 1 } } },
      ]),
      this.linkModel.find({ userId: uid }).select('name type').sort({ order: 1, _id: 1 }),
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
      links: links
        .filter((l) => l.type !== 'Cabecalho')
        .map((l) => ({ id: String(l._id), name: l.name, clicks: clicksByLink.get(String(l._id)) ?? 0 }))
        .sort((a, b) => b.clicks - a.clicks),
    };
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
