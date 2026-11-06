import { Types } from 'mongoose';
import { model } from 'mongoose';
import { LinkSchema } from './link.schema';

describe('Link schema serialization', () => {
  const Link = model('LinkSerializationTest', LinkSchema);

  it('never serializes the password hash, even on a freshly built document', () => {
    const doc = new Link({
      name: 'VIP',
      link: 'https://a.com',
      type: 'Link',
      userId: new Types.ObjectId(),
      locked: true,
      passwordHash: 'bcrypt-hash',
    });
    const json = JSON.parse(JSON.stringify(doc));
    expect(json.locked).toBe(true);
    expect(json).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(json)).not.toContain('bcrypt-hash');
    expect(typeof json.id).toBe('string');
  });

  it('has safe defaults for the new fields', () => {
    const doc: any = new Link({
      name: 'N',
      link: 'https://a.com',
      type: 'Link',
      userId: new Types.ObjectId(),
    });
    expect(doc.toJSON()).toMatchObject({
      featured: false,
      embed: false,
      locked: false,
      thumbnail: null,
      startAt: null,
      endAt: null,
      pageId: null,
    });
  });

  it('adds the player URL of embedded links (and null otherwise)', () => {
    const yt: any = new Link({
      name: 'V',
      link: 'https://youtu.be/dQw4w9WgXcQ',
      type: 'Youtube',
      userId: new Types.ObjectId(),
      embed: true,
    });
    const plain: any = new Link({
      name: 'N',
      link: 'https://a.com',
      type: 'Link',
      userId: new Types.ObjectId(),
    });
    expect(yt.toJSON().embedUrl).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    );
    expect(plain.toJSON().embedUrl).toBeNull();
  });
});
