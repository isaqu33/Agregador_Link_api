import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Page, PageDocument } from '../pages/schemas/page.schema';
import { User, UserDocument } from '../user/schemas/user.schema';
import { isDuplicateKey } from '../common/profile-rules';
import { Handle, HandleDocument } from './handle.schema';

@Injectable()
export class HandlesService implements OnModuleInit {
  private readonly logger = new Logger(HandlesService.name);

  constructor(
    @InjectModel(Handle.name) private handleModel: Model<HandleDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Page.name) private pageModel: Model<PageDocument>,
  ) {}

  /** Usernames that existed before this collection did get their claim (idempotent, safe to repeat). */
  async onModuleInit() {
    let claimed = 0;
    for (const model of [this.userModel, this.pageModel] as Model<any>[]) {
      const rows = await model
        .find({ username: { $exists: true, $nin: [null, ''] } })
        .select('username');
      for (const row of rows) {
        const res = await this.handleModel.updateOne(
          { _id: row.username },
          { $setOnInsert: { ownerId: String(row._id) } },
          { upsert: true },
        );
        claimed += res.upsertedCount ?? 0;
      }
    }
    if (claimed) this.logger.log(`Backfilled ${claimed} username claim(s)`);
  }

  /** Takes `username` for `ownerId`. 409 if somebody else already holds it; claiming your own name again is fine. */
  async claim(username: string, ownerId: string) {
    try {
      await this.handleModel.create({ _id: username, ownerId });
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      const current = await this.handleModel.findById(username);
      if (current?.ownerId !== ownerId) {
        throw new ConflictException('Nome de usuário já está em uso');
      }
    }
  }

  /**
   * Changes the owner's username safely: claim the new name first (the database picks one winner),
   * run the real update, then give the old name back. If the update fails, the new claim is undone.
   */
  async rename<T>(
    ownerId: string,
    next: string | undefined,
    current: string | undefined,
    apply: () => PromiseLike<T>,
  ): Promise<T> {
    if (next === undefined || next === current) return await apply();
    await this.claim(next, ownerId);
    let result: T;
    try {
      result = await apply();
    } catch (error) {
      await this.release(next, ownerId);
      throw error;
    }
    if (current) await this.release(current, ownerId);
    return result;
  }

  /** Gives the name back (only if `ownerId` really holds it). */
  async release(username: string, ownerId: string) {
    await this.handleModel.deleteOne({ _id: username, ownerId });
  }
}
