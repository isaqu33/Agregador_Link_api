import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { Event, EventDocument } from '../analytics/schemas/event.schema';
import {
  checkProfileInput,
  isDuplicateKey,
  profileChanges,
} from '../common/profile-rules';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { Link, LinkDocument } from '../links/schemas/link.schema';
import { User, UserDocument } from '../user/schemas/user.schema';
import { CreatePageDto, EditPageDto } from './dto/page.dto';
import { Page, PageDocument } from './schemas/page.schema';

export const MAX_EXTRA_PAGES = 5;

@Injectable()
export class PagesService {
  constructor(
    @InjectModel(Page.name) private pageModel: Model<PageDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Link.name) private linkModel: Model<LinkDocument>,
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
  ) {}

  async create(userId: string, { name }: CreatePageDto) {
    if ((await this.pageModel.countDocuments({ userId })) >= MAX_EXTRA_PAGES) {
      throw new BadRequestException(
        `Limite de ${MAX_EXTRA_PAGES} páginas extras por conta`,
      );
    }
    return this.pageModel.create({
      userId,
      name: name.trim(),
      title: name.trim(),
    });
  }

  // Page + its links, in the shape the panel already uses for the main page.
  async findOne(userId: string, pageId: string) {
    const page = await this.findOwned(userId, pageId);
    const links = await this.linkModel
      .find({ userId, pageId: page._id })
      .sort({ order: 1, _id: 1 });
    return { ...page.toJSON(), links };
  }

  async edit(userId: string, dto: EditPageDto) {
    const page = await this.findOwned(userId, dto.id);
    checkProfileInput(dto);
    if (
      dto.username !== undefined &&
      (await this.userModel.exists({ username: dto.username }))
    ) {
      throw new ConflictException('Nome de usuário já está em uso');
    }

    try {
      return await this.pageModel.findByIdAndUpdate(
        page._id,
        profileChanges(dto),
        {
          new: true,
        },
      );
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new ConflictException('Nome de usuário já está em uso');
      }
      throw error;
    }
  }

  // Removes the page and everything that belonged to it.
  async remove(userId: string, pageId: string) {
    const page = await this.findOwned(userId, pageId);
    await Promise.all([
      this.linkModel.deleteMany({ userId, pageId: page._id }),
      this.leadModel.deleteMany({ userId, pageId: page._id }),
      this.eventModel.deleteMany({ userId, pageId: page._id }),
    ]);
    await page.deleteOne();
    return { ok: true };
  }

  // Someone else's page is reported as missing, so ids can't be probed.
  private async findOwned(userId: string, pageId: string) {
    const page = isValidObjectId(pageId)
      ? await this.pageModel.findOne({ _id: pageId, userId })
      : null;
    if (!page) throw new NotFoundException('Página não encontrada');
    return page;
  }
}
