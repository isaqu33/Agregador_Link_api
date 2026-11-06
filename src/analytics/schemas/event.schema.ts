import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

// One row per page view or link click of a public page.
@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false,
})
export class Event {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: ['view', 'click'] })
  type: 'view' | 'click';

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Link' })
  linkId?: Types.ObjectId;

  // extra page the event belongs to (null = main page)
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Page', default: null })
  pageId?: Types.ObjectId | null;

  // views only: how the visitor arrived
  @Prop({ type: String, enum: ['mobile', 'tablet', 'desktop'] })
  device?: 'mobile' | 'tablet' | 'desktop';

  // host of the page that linked here ("direto" when none)
  @Prop({ type: String, maxlength: 100 })
  referrer?: string;

  createdAt: Date;
}

export type EventDocument = HydratedDocument<Event>;
export const EventSchema = SchemaFactory.createForClass(Event);
EventSchema.index({ userId: 1, createdAt: -1 });
