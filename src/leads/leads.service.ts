import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { toCsv } from '../common/csv';
import { Link, LinkDocument } from '../links/schemas/link.schema';
import { CaptureLeadDto } from './dto/lead.dto';
import { Lead, LeadDocument } from './schemas/lead.schema';

const pageFilter = (pageId?: string) =>
  pageId && isValidObjectId(pageId) ? { pageId: new Types.ObjectId(pageId) } : { pageId: null };

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

  async list(userId: string, pageId?: string) {
    const [leads, forms] = await Promise.all([
      this.leadModel
        .find({ userId, ...pageFilter(pageId) })
        .sort({ createdAt: -1 })
        .limit(500),
      this.linkModel.find({ userId, type: 'Newsletter', ...pageFilter(pageId) }).select('name'),
    ]);
    const formName = new Map(forms.map((f) => [String(f._id), f.name]));
    return {
      total: leads.length,
      leads: leads.map((l) => ({
        id: String(l._id),
        email: l.email,
        name: l.name,
        form: formName.get(String(l.linkId)) ?? '(formulário removido)',
        createdAt: l.createdAt,
      })),
    };
  }

  async remove(userId: string, id: string) {
    const res = await this.leadModel.deleteOne({ _id: id, userId });
    if (!res.deletedCount) throw new NotFoundException('Contato não encontrado');
    return { ok: true };
  }

  async exportCsv(userId: string, pageId?: string) {
    const { leads } = await this.list(userId, pageId);
    return toCsv(
      ['email', 'nome', 'formulario', 'data'],
      leads.map((l) => [l.email, l.name, l.form, new Date(l.createdAt).toISOString()]),
    );
  }
}
