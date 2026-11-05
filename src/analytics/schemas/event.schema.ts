import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

// One row per page view or link click of a public page.
@Schema({ timestamps: { createdAt: true, updatedAt: false }, versionKey: false })
export class Event {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: ['view', 'click'] })
  type: 'view' | 'click';

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Link' })
  linkId?: Types.ObjectId;

  createdAt: Date;
}

export type EventDocument = HydratedDocument<Event>;
export const EventSchema = SchemaFactory.createForClass(Event);
EventSchema.index({ userId: 1, createdAt: -1 });
