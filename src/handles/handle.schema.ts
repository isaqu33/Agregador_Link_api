import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// A claimed @username. The username is the `_id`, so the database itself guarantees that
// only one owner (a user OR an extra page) can hold it: unique indexes cannot span collections,
// a single collection can.
@Schema({ collection: 'handles' })
export class Handle {
  @Prop({ type: String, required: true })
  _id: string;

  // user id (main page) or page id (extra page)
  @Prop({ type: String, required: true })
  ownerId: string;
}

export type HandleDocument = HydratedDocument<Handle>;
export const HandleSchema = SchemaFactory.createForClass(Handle);
