import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { Link, LinkDocument } from './../links/schemas/link.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';
import {
  checkProfileInput,
  isDuplicateKey,
  profileChanges,
} from '../common/profile-rules';
import { HandlesService } from '../handles/handles.service';
import { Page, PageDocument } from '../pages/schemas/page.schema';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Link.name) private linkModel: Model<LinkDocument>,
    @InjectModel(Page.name) private pageModel: Model<PageDocument>,
    private handles: HandlesService,
  ) {}

  // Includes the password hash: for login only, never return this to a client.
  async findByEmailWithPassword(email: string) {
    return this.userModel.findOne({ email }).select('+password');
  }

  async findOne(email: string) {
    return this.userModel.findOne({ email });
  }

  async findMe(userId: string) {
    if (!isValidObjectId(userId)) return null;

    const user = await this.userModel.findById(userId);
    if (!user) return null;

    // main page links only; extra pages are listed in `pages` and loaded on demand
    const links = await this.linkModel
      .find({ userId: user._id, pageId: null })
      .sort({ order: 1, _id: 1 });
    const pages = await this.pageModel
      .find({ userId: user._id })
      .sort({ _id: 1 })
      .select('name username');
    return {
      ...user.toJSON(),
      links,
      pages: pages.map((p) => ({
        id: String(p._id),
        name: p.name,
        username: p.username,
      })),
    };
  }

  async createNewUser({
    name,
    email,
    passwordHash,
    emailVerified,
  }: CreateUserDto) {
    return this.userModel.create({
      name,
      email,
      password: passwordHash,
      emailVerified: emailVerified ?? false,
    });
  }

  async editProfireUser(userId: string, dto: UpdateUserDto) {
    checkProfileInput(dto, userId);
    if (
      dto.username !== undefined &&
      (await this.pageModel.exists({ username: dto.username }))
    ) {
      throw new ConflictException('Nome de usuário já está em uso');
    }

    try {
      const current =
        dto.username === undefined
          ? undefined
          : (await this.userModel.findById(userId).select('username'))
              ?.username;
      return await this.handles.rename(userId, dto.username, current, () =>
        this.userModel.findByIdAndUpdate(userId, profileChanges(dto), {
          new: true,
        }),
      );
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new ConflictException('Nome de usuário já está em uso');
      }
      throw error;
    }
  }

  async findByUsername(username: string) {
    return this.userModel.findOne({ username: username.toLowerCase() });
  }

  // --- one-time tokens (email verification / password reset): only sha256 is stored ---

  async setEmailVerifyHash(userId: string, hash: string) {
    await this.userModel.updateOne({ _id: userId }, { emailVerifyHash: hash });
  }

  async verifyEmailByHash(hash: string) {
    const user = await this.userModel
      .findOneAndUpdate(
        { emailVerifyHash: hash },
        { emailVerified: true, $unset: { emailVerifyHash: 1 } },
        { new: true },
      )
      .select('+emailVerifyHash');
    return user;
  }

  // Returns null when a reset was already requested in the last `minGapMs` (silent throttle).
  async startPasswordReset(email: string, hash: string, minGapMs: number) {
    const user = await this.userModel
      .findOne({ email })
      .select('+resetRequestedAt');
    if (!user) return null;
    if (
      user.resetRequestedAt &&
      Date.now() - user.resetRequestedAt.getTime() < minGapMs
    ) {
      return null;
    }
    user.resetHash = hash;
    user.resetExpires = new Date(Date.now() + 60 * 60 * 1000);
    user.resetRequestedAt = new Date();
    await user.save();
    return user;
  }

  async finishPasswordReset(hash: string, passwordHash: string) {
    return this.userModel.findOneAndUpdate(
      { resetHash: hash, resetExpires: { $gt: new Date() } },
      {
        password: passwordHash,
        emailVerified: true, // they proved they own the mailbox
        $unset: { resetHash: 1, resetExpires: 1 },
      },
      { new: true },
    );
  }

  async findById(userId: string) {
    return isValidObjectId(userId) ? this.userModel.findById(userId) : null;
  }

  async markEmailVerified(userId: string) {
    await this.userModel.updateOne({ _id: userId }, { emailVerified: true });
  }
}
