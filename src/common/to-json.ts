// Responses keep the shape the front already uses: `id` as a string, no _id/__v.
export const jsonOptions = {
  versionKey: false,
  transform: (_doc: unknown, ret: Record<string, any>) => {
    ret.id = String(ret._id);
    delete ret._id;
    return ret;
  },
};
