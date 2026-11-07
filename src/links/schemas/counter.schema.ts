import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// One atomic counter per list of links (`link-order:<userId>:<pageId|main>`). Handing out the
// next position with `$inc` means two simultaneous creations can never get the same number.
@Schema({ collection: 'counters' })
export class Counter {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: Number, required: true, default: -1 })
  seq: number;
}

export type CounterDocument = HydratedDocument<Counter>;
export const CounterSchema = SchemaFactory.createForClass(Counter);
