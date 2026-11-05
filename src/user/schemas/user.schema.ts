import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { jsonOptions } from './../../common/to-json';

@Schema({ toJSON: jsonOptions })
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  // Hash only. Not selected by default: login asks for it with .select('+password').
  @Prop({ select: false })
  password?: string;

  @Prop({ type: String, default: null })
  photoURL?: string | null;

  @Prop({ type: String, default: null })
  template?: string | null;

  @Prop({ type: String, default: null })
  title?: string | null;

  @Prop({ type: String, default: null })
  about?: string | null;

  // Public handle: /@username. Optional, so users created before it keep working.
  @Prop({ type: String, unique: true, sparse: true, lowercase: true, trim: true })
  username?: string;

  // Icons shown at the top of the public page.
  @Prop({
    type: [{ _id: false, network: String, url: String }],
    default: [],
  })
  socials: { network: string; url: string }[];

  @Prop({ default: false })
  emailVerified: boolean;

  // Only hashes (sha256) of the one-time tokens are stored.
  @Prop({ type: String, select: false })
  emailVerifyHash?: string;

  @Prop({ type: String, select: false })
  resetHash?: string;

  @Prop({ type: Date, select: false })
  resetExpires?: Date;

  @Prop({ type: Date, select: false })
  resetRequestedAt?: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
