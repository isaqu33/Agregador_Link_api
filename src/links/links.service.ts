import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { isValidObjectId, Model, Types } from 'mongoose';
import { CacheService } from '../cache/cache.service';
import { EMBED_TYPES, toEmbedUrl } from '../common/embed';
import { assertValidLink, NO_URL_TYPES } from '../common/link-rules';
import { Page, PageDocument } from '../pages/schemas/page.schema';
import { User, UserDocument } from './../user/schemas/user.schema';
import { CreateLinkDto } from './dto/create-link.dto';
import { EditLinkDto } from './dto/edit-link.dto';
import { LinkOptionsDto } from './dto/link-options.dto';
import { Link, LinkDocument } from './schemas/link.schema';

const MAX_UNLOCK_FAILURES = 5;
const UNLOCK_WINDOW_SECONDS = 15 * 60;

@Injectable()
export class LinksService {
  constructor(
    @InjectModel(Link.name) private linkModel: Model<LinkDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Page.name) private pageModel: Model<PageDocument>,
    private cache: CacheService,
  ) {}

  async createlink(userId: string, dto: CreateLinkDto) {
    const { name, type } = dto;
    assertValidLink(type, dto.link);
    const link = NO_URL_TYPES.includes(type) ? '' : dto.link ?? '';
    const pageId = await this.ownedPageId(userId, dto.pageId);
    const extras = await this.buildExtras(userId, type, link, dto);

    // goes to the end of the list (of its page)
    const last = await this.linkModel
      .findOne({ userId, pageId })
      .sort({ order: -1 })
      .select('order');
    const order = last ? last.order + 1 : 0;

    return this.linkModel.create({
      name,
      link,
      type,
      userId,
      pageId,
      order,
      ...extras,
    });
  }

  async removelink(userId: string, idlink: string) {
    const link = await this.findOwnedLink(userId, idlink);
    await link.deleteOne();

    return link;
  }

  // Public page: no email, inactive and out-of-schedule links stay hidden, and the destination of
  // a password-protected link is never sent. Accepts a user/page id or the @username.
  async findAllDataUserById(idOrUsername: string) {
    const source = await this.resolveProfile(idOrUsername);
    if (!source) throw new NotFoundException('Usuário não encontrado');

    const now = new Date();
    const links = await this.linkModel
      .find({
        userId: source.ownerId,
        pageId: source.pageId,
        isActivit: true,
        $and: [
          { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
          { $or: [{ endAt: null }, { endAt: { $gt: now } }] },
        ],
      })
      .sort({ order: 1, _id: 1 });

    const {
      name,
      photoURL,
      template,
      title,
      about,
      username,
      socials,
      pixels,
    } = source.doc;

    return {
      id: String(source.doc._id),
      name,
      photoURL,
      template,
      title,
      about,
      username,
      socials,
      pixels,
      links: links.map((l) => this.toPublicLink(l)),
    };
  }

  // Returns the destination of a protected link when the password is right.
  async unlock(linkId: string, password: string) {
    const failKey = `unlock-fail:${linkId}`;
    if ((await this.cache.count(failKey)) >= MAX_UNLOCK_FAILURES) {
      throw new HttpException(
        'Muitas tentativas. Tente novamente em alguns minutos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const link = await this.linkModel
      .findOne({ _id: linkId, isActivit: true, locked: true })
      .select('+passwordHash');
    const ok = link?.passwordHash
      ? await bcrypt.compare(password, link.passwordHash)
      : false;
    if (!link || !ok) {
      await this.cache.incr(failKey, UNLOCK_WINDOW_SECONDS);
      throw new UnauthorizedException('Senha incorreta');
    }

    await this.cache.reset(failKey);
    return { link: link.link };
  }

  async updateActive(userId: string, linkId: string, activation: boolean) {
    const link = await this.findOwnedLink(userId, linkId);
    link.isActivit = activation;

    return link.save();
  }

  // The type stays as created; the destination is validated against it.
  async updateLink(userId: string, dto: EditLinkDto) {
    const found = await this.findOwnedLink(userId, dto.id);
    if (dto.link !== undefined && !NO_URL_TYPES.includes(found.type)) {
      assertValidLink(found.type, dto.link);
      found.link = dto.link;
    }
    if (dto.name !== undefined) found.name = dto.name;

    const extras = await this.buildExtras(
      userId,
      found.type,
      found.link,
      dto,
      found,
    );
    Object.assign(found, extras);
    if (dto.removePassword) {
      found.locked = false;
      found.passwordHash = undefined;
    }

    return found.save();
  }

  // Position i in `ids` becomes order i. Every id must belong to the user.
  async reorder(userId: string, ids: string[]) {
    const owned = await this.linkModel.countDocuments({
      _id: { $in: ids.filter((id) => isValidObjectId(id)) },
      userId,
    });
    if (owned !== ids.length)
      throw new NotFoundException('Link não encontrado');

    await this.linkModel.bulkWrite(
      ids.map((id, order) => ({
        updateOne: { filter: { _id: id, userId }, update: { $set: { order } } },
      })),
    );

    return { ok: true };
  }

  // --- helpers ---

  // Validates the optional extras and returns the fields to store. `current` = link being edited.
  private async buildExtras(
    userId: string,
    type: string,
    link: string,
    dto: LinkOptionsDto & { link?: string },
    current?: LinkDocument,
  ) {
    const extras: Record<string, unknown> = {};

    if (dto.thumbnail !== undefined) {
      if (dto.thumbnail !== null && !isOwnedImage(userId, dto.thumbnail)) {
        throw new BadRequestException('Miniatura inválida');
      }
      extras.thumbnail = dto.thumbnail;
    }
    if (dto.featured !== undefined) extras.featured = dto.featured;

    if (dto.startAt !== undefined)
      extras.startAt = dto.startAt ? new Date(dto.startAt) : null;
    if (dto.endAt !== undefined)
      extras.endAt = dto.endAt ? new Date(dto.endAt) : null;
    const start = (extras.startAt ??
      (dto.startAt === undefined ? current?.startAt : null)) as
      | Date
      | null
      | undefined;
    const end = (extras.endAt ??
      (dto.endAt === undefined ? current?.endAt : null)) as
      | Date
      | null
      | undefined;
    if (start && end && end <= start) {
      throw new BadRequestException(
        'O fim do agendamento deve ser depois do início',
      );
    }

    if (dto.embed !== undefined) {
      if (
        dto.embed &&
        !(EMBED_TYPES.includes(type) && toEmbedUrl(type, link))
      ) {
        throw new BadRequestException(
          'Este link não tem player (use um link do YouTube ou Spotify)',
        );
      }
      extras.embed = dto.embed;
    } else if (
      current?.embed &&
      dto.link !== undefined &&
      !toEmbedUrl(type, link)
    ) {
      extras.embed = false; // the new URL no longer has a player
    }

    if (dto.password !== undefined) {
      if (NO_URL_TYPES.includes(type)) {
        throw new BadRequestException('Este tipo não pode ter senha');
      }
      extras.passwordHash = await bcrypt.hash(dto.password, 10);
      extras.locked = true;
    }

    return extras;
  }

  private toPublicLink(doc: any) {
    const l = typeof doc.toJSON === 'function' ? doc.toJSON() : { ...doc };
    delete l.passwordHash;
    delete l.userId;
    l.embedUrl = l.embed ? toEmbedUrl(l.type, l.link) : null; // toJSON already adds it; recomputed for plain objects
    if (l.locked) {
      l.link = ''; // revealed only by /links/unlock
      l.embedUrl = null;
    }
    return l;
  }

  // Resolves what the public page shows: a user (main page) or an extra page.
  private async resolveProfile(idOrUsername: string) {
    const handle = idOrUsername.replace(/^@/, '').toLowerCase();

    if (isValidObjectId(idOrUsername)) {
      const user = await this.userModel.findById(idOrUsername);
      if (user) return { doc: user, ownerId: user._id, pageId: null };
      const page = await this.pageModel.findById(idOrUsername);
      return page
        ? { doc: page, ownerId: page.userId, pageId: page._id }
        : null;
    }

    const user = await this.userModel.findOne({ username: handle });
    if (user) return { doc: user, ownerId: user._id, pageId: null };
    const page = await this.pageModel.findOne({ username: handle });
    return page ? { doc: page, ownerId: page.userId, pageId: page._id } : null;
  }

  private async ownedPageId(userId: string, pageId?: string | null) {
    if (!pageId) return null;
    const owned = isValidObjectId(pageId)
      ? await this.pageModel.exists({ _id: pageId, userId })
      : null;
    if (!owned) throw new NotFoundException('Página não encontrada');
    return new Types.ObjectId(pageId);
  }

  // A link that belongs to someone else is reported as missing, so ids can't be probed.
  private async findOwnedLink(userId: string, id: string) {
    const link = isValidObjectId(id)
      ? await this.linkModel.findOne({ _id: id, userId })
      : null;
    if (!link) throw new NotFoundException('Link não encontrado');

    return link;
  }
}

// thumbnails must be images of the owner (uploaded through /media) or bundled assets
function isOwnedImage(userId: string, path: string) {
  return path.startsWith(`/media/${userId}/`) || path.startsWith('/assets/');
}
