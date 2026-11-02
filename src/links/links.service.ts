import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { User, UserDocument } from './../user/schemas/user.schema';
import { CreateLinkDto } from './dto/create-link.dto';
import { EditLinkDto } from './dto/edit-link.dto';
import { Link, LinkDocument } from './schemas/link.schema';

@Injectable()
export class LinksService {
  constructor(
    @InjectModel(Link.name) private linkModel: Model<LinkDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async createlink(userId: string, { name, link, type }: CreateLinkDto) {
    // goes to the end of the list
    const last = await this.linkModel
      .findOne({ userId })
      .sort({ order: -1 })
      .select('order');
    const order = last ? last.order + 1 : 0;

    return this.linkModel.create({ name, link, type, userId, order });
  }

  async removelink(userId: string, idlink: string) {
    const link = await this.findOwnedLink(userId, idlink);
    await link.deleteOne();

    return link;
  }

  // Public page: no email, and inactive links stay hidden.
  async findAllDataUserById(userId: string) {
    const user = isValidObjectId(userId)
      ? await this.userModel.findById(userId)
      : null;
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const links = await this.linkModel
      .find({ userId: user._id, isActivit: true })
      .sort({ order: 1, _id: 1 });
    const { name, photoURL, template, title, about } = user;

    return {
      id: String(user._id),
      name,
      photoURL,
      template,
      title,
      about,
      links,
    };
  }

  async updateActive(userId: string, linkId: string, activation: boolean) {
    const link = await this.findOwnedLink(userId, linkId);
    link.isActivit = activation;

    return link.save();
  }

  // Only name and link are editable; the type stays as created.
  async updateLink(userId: string, { id, name, link }: EditLinkDto) {
    const found = await this.findOwnedLink(userId, id);
    if (name !== undefined) found.name = name;
    if (link !== undefined) found.link = link;

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

  // A link that belongs to someone else is reported as missing, so ids can't be probed.
  private async findOwnedLink(userId: string, id: string) {
    const link = isValidObjectId(id)
      ? await this.linkModel.findOne({ _id: id, userId })
      : null;
    if (!link) throw new NotFoundException('Link não encontrado');

    return link;
  }
}
