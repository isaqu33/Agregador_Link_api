import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { toCsv } from '../common/csv';
import { Link, LinkDocument } from '../links/schemas/link.schema';
import { CaptureLeadDto } from './dto/lead.dto';
import { Lead, LeadDocument } from './schemas/lead.schema';

const MAX_EXPORT = 10000;

const pageFilter = (pageId?: string) =>
  pageId && isValidObjectId(pageId)
    ? { pageId: new Types.ObjectId(pageId) }
    : { pageId: null };

@Injectable()
export class LeadsService {
  constructor(
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    @InjectModel(Link.name) private linkModel: Model<LinkDocument>,
  ) {}

  // Public. Answers ok for anything a bot could probe (unknown form, honeypot, repeated e-mail).
  async capture({ linkId, email, name, website }: CaptureLeadDto) {
    if (website) return { ok: true };

    const link = await this.linkModel
      .findOne({ _id: linkId, isActivit: true, type: 'Newsletter' })
      .select('userId pageId');
    if (!link) return { ok: true };

    await this.leadModel.updateOne(
      { linkId: link._id, email: email.trim().toLowerCase() },
      {
        $setOnInsert: {
          userId: link.userId,
          pageId: link.pageId ?? null,
          name: name?.trim() || null,
        },
      },
      { upsert: true },
    );
    return { ok: true };
  }

  /**
   * One page of contacts, newest first. The cursor is the `_id` of the last row already seen
   * (ObjectIds grow with time): "give me what is older than this". Unlike skip/limit it stays fast
   * on page 1000 and does not repeat or skip rows when new contacts arrive meanwhile.
   */
  async list(
    userId: string,
    pageId?: string,
    options: { limit?: number; cursor?: string } = {},
  ) {
    const limit = Math.min(Math.max(Math.trunc(options.limit ?? 50), 1), 200);
    const scope = { userId, ...pageFilter(pageId) };
    let filter: Record<string, unknown> = scope;
    if (options.cursor) {
      if (!isValidObjectId(options.cursor)) {
        throw new BadRequestException('cursor inválido');
      }
      filter = { ...scope, _id: { $lt: new Types.ObjectId(options.cursor) } };
    }

    const [rows, forms, total] = await Promise.all([
      this.leadModel
        .find(filter)
        .sort({ _id: -1 })
        .limit(limit + 1),
      this.linkModel.find({ ...scope, type: 'Newsletter' }).select('name'),
      this.leadModel.countDocuments(scope),
    ]);
    const hasMore = rows.length > limit;
    const leads = rows.slice(0, limit);
    return {
      total,
      leads: this.present(leads, forms),
      nextCursor: hasMore ? String(leads[leads.length - 1]._id) : null,
    };
  }

  private present(
    leads: LeadDocument[],
    forms: { _id: unknown; name: string }[],
  ) {
    const formName = new Map(forms.map((f) => [String(f._id), f.name]));
    return leads.map((l) => ({
      id: String(l._id),
      email: l.email,
      name: l.name,
      form: formName.get(String(l.linkId)) ?? '(formulário removido)',
      createdAt: l.createdAt,
    }));
  }

  async remove(userId: string, id: string) {
    const res = await this.leadModel.deleteOne({ _id: id, userId });
    if (!res.deletedCount)
      throw new NotFoundException('Contato não encontrado');
    return { ok: true };
  }

  async exportCsv(userId: string, pageId?: string) {
    const scope = { userId, ...pageFilter(pageId) };
    const [rows, forms] = await Promise.all([
      this.leadModel.find(scope).sort({ _id: -1 }).limit(MAX_EXPORT),
      this.linkModel.find({ ...scope, type: 'Newsletter' }).select('name'),
    ]);
    return toCsv(
      ['email', 'nome', 'formulario', 'data'],
      this.present(rows, forms).map((l) => [
        l.email,
        l.name,
        l.form,
        new Date(l.createdAt).toISOString(),
      ]),
    );
  }
}
