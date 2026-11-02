import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { User, UserDocument } from './../user/schemas/user.schema';
import { CreateLinkDto } from './dto/create-link.dto';
import { Link, LinkDocument } from './schemas/link.schema';

@Injectable()
export class LinksService {
  constructor(
    @InjectModel(Link.name) private linkModel: Model<LinkDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async createlink(userId: string, { name, link, type }: CreateLinkDto) {
    return this.linkModel.create({ name, link, type, userId });
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

    const links = await this.linkModel.find({
      userId: user._id,
      isActivit: true,
    });
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

  // A link that belongs to someone else is reported as missing, so ids can't be probed.
  private async findOwnedLink(userId: string, id: string) {
    const link = isValidObjectId(id)
      ? await this.linkModel.findOne({ _id: id, userId })
      : null;
    if (!link) throw new NotFoundException('Link não encontrado');

    return link;
  }
}
