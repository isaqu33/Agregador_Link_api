import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { jsonOptions } from './../../common/to-json';

// A visitor who left an e-mail in a "Newsletter" link of someone's page.
@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  toJSON: {
    ...jsonOptions,
    transform: (doc, ret) => {
      jsonOptions.transform(doc, ret);
      ret.userId = String(ret.userId);
      ret.linkId = String(ret.linkId);
      return ret;
    },
  },
})
export class Lead {
  // owner of the page
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Page', default: null })
  pageId?: Types.ObjectId | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Link', required: true })
  linkId: Types.ObjectId;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ type: String, default: null, trim: true })
  name?: string | null;

  createdAt: Date;
}

export type LeadDocument = HydratedDocument<Lead>;
export const LeadSchema = SchemaFactory.createForClass(Lead);
// the same e-mail counts once per form
LeadSchema.index({ linkId: 1, email: 1 }, { unique: true });
