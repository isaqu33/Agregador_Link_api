import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { jsonOptions } from './../../common/to-json';

// An extra public page of an account. The main page is the User itself (kept for compatibility);
// links of an extra page carry its id in `Link.pageId`.
@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  toJSON: {
    ...jsonOptions,
    transform: (doc, ret) => {
      jsonOptions.transform(doc, ret);
      ret.userId = String(ret.userId);
      return ret;
    },
  },
})
export class Page {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  // label shown in the page switcher of the panel
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, unique: true, sparse: true, lowercase: true, trim: true })
  username?: string;

  @Prop({ type: String, default: null })
  photoURL?: string | null;

  @Prop({ type: String, default: null })
  template?: string | null;

  @Prop({ type: String, default: null })
  title?: string | null;

  @Prop({ type: String, default: null })
  about?: string | null;

  @Prop({ type: [{ _id: false, network: String, url: String }], default: [] })
  socials: { network: string; url: string }[];

  @Prop({ type: { _id: false, meta: String, ga: String }, default: {} })
  pixels: { meta?: string; ga?: string };
}

export type PageDocument = HydratedDocument<Page>;
export const PageSchema = SchemaFactory.createForClass(Page);
