import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { Link, LinkDocument } from './../links/schemas/link.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';
import { RESERVED_USERNAMES, socialUrlError } from '../common/link-rules';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Link.name) private linkModel: Model<LinkDocument>,
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

    const links = await this.linkModel
      .find({ userId: user._id })
      .sort({ order: 1, _id: 1 });
    return { ...user.toJSON(), links };
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

  async editProfireUser(
    userId: string,
    { name, photoURL, template, title, about, username, socials }: UpdateUserDto,
  ) {
    if (username !== undefined && RESERVED_USERNAMES.has(username)) {
      throw new ConflictException('Nome de usuário indisponível');
    }
    for (const social of socials ?? []) {
      const error = socialUrlError(social.network, social.url);
      if (error) throw new BadRequestException(`${social.network}: ${error}`);
    }

    const changes = Object.fromEntries(
      Object.entries({
        name,
        photoURL,
        template,
        title,
        about,
        username,
        socials,
      }).filter(([, value]) => value !== undefined),
    );

    try {
      return await this.userModel.findByIdAndUpdate(userId, changes, {
        new: true,
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
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
}
