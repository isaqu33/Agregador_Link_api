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
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
