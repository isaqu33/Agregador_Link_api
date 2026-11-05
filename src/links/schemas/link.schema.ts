import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { jsonOptions } from './../../common/to-json';

@Schema({
  toJSON: {
    ...jsonOptions,
    transform: (doc, ret) => {
      jsonOptions.transform(doc, ret);
      ret.userId = String(ret.userId);
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
