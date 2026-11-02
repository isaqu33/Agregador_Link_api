import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { Link, LinkDocument } from './../links/schemas/link.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';

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

    const links = await this.linkModel.find({ userId: user._id });
    return { ...user.toJSON(), links };
  }

  async createNewUser({ name, email, passwordHash }: CreateUserDto) {
    return this.userModel.create({ name, email, password: passwordHash });
  }

  async editProfireUser(
    userId: string,
    { name, photoURL, template, title, about }: UpdateUserDto,
  ) {
    const changes = Object.fromEntries(
      Object.entries({ name, photoURL, template, title, about }).filter(
        ([, value]) => value !== undefined,
      ),
    );

    return this.userModel.findByIdAndUpdate(userId, changes, { new: true });
  }
}
