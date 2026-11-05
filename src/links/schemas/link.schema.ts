import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { toEmbedUrl } from '../../common/embed';
import { jsonOptions } from './../../common/to-json';

@Schema({
  toJSON: {
    ...jsonOptions,
    transform: (doc, ret) => {
      jsonOptions.transform(doc, ret);
      ret.userId = String(ret.userId);
      // select:false does not hide it on a just-created/saved document: never serialize it
      delete ret.passwordHash;
      // player URL of embedded links (owner view and public page; the public page hides it when locked)
      ret.embedUrl = ret.embed ? toEmbedUrl(ret.type, ret.link) : null;
      return ret;
    },
  },
})
export class Link {
  @Prop({ required: true })
  name: string;

  // empty for headers (type Cabecalho)
  @Prop({ default: '' })
  link: string;

  @Prop({ required: true })
  type: string;

  // Display position (ascending). Links created before this field existed default to 0
  // and fall back to creation order.
  @Prop({ default: 0 })
  order: number;

  // Small image shown next to the title (a /media path of the owner)
  @Prop({ type: String, default: null })
  thumbnail?: string | null;

  // Shown bigger on the page
  @Prop({ default: false })
  featured: boolean;

  // Visible only between these dates (either one may be empty)
  @Prop({ type: Date, default: null })
  startAt?: Date | null;

  @Prop({ type: Date, default: null })
  endAt?: Date | null;

  // YouTube/Spotify: show the player instead of a button
  @Prop({ default: false })
  embed: boolean;

  // Password-protected: `locked` is public; the hash never leaves the API
  @Prop({ default: false })
  locked: boolean;

  @Prop({ type: String, select: false })
  passwordHash?: string;

  // null/missing = main page (the User); otherwise an extra Page of the owner
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Page',
    default: null,
    index: true,
  })
  pageId?: Types.ObjectId | null;

  // Kept with the original (misspelled) name: the front reads it.
  @Prop({ default: true })
  isActivit: boolean;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;
}

export type LinkDocument = HydratedDocument<Link>;
export const LinkSchema = SchemaFactory.createForClass(Link);
