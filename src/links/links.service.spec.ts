import * as bcrypt from 'bcryptjs';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { configStub, query } from '../test-utils';
import { LinksService } from './links.service';

const OID = (n: number) => n.toString(16).padStart(24, '0'); // valid ObjectId strings

describe('LinksService', () => {
  let linkModel: Record<string, jest.Mock>;
  let userModel: Record<string, jest.Mock>;
  let pageModel: Record<string, jest.Mock>;
  let cache: CacheService;
  let counterModel: Record<string, jest.Mock>;
  let seq: number;
  let service: LinksService;

  beforeEach(() => {
    linkModel = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation(async (doc) => doc),
      countDocuments: jest.fn(),
      bulkWrite: jest.fn().mockResolvedValue({}),
    };
    seq = 0;
    counterModel = {
      exists: jest.fn().mockResolvedValue({ _id: 'k' }),
      updateOne: jest.fn().mockResolvedValue({}),
      findOneAndUpdate: jest
        .fn()
        .mockImplementation(async () => ({ seq: seq++ })),
    };
    userModel = { findById: jest.fn(), findOne: jest.fn() };
    pageModel = {
      exists: jest.fn(),
      findById: jest.fn().mockResolvedValue(null),
      findOne: jest.fn().mockResolvedValue(null),
    };
    cache = new CacheService(configStub());
    service = new LinksService(
      linkModel as any,
      userModel as any,
      pageModel as any,
      cache,
      counterModel as any,
    );
  });

  describe('createlink', () => {
    it('puts the new link at the end of the list (position from the atomic counter)', async () => {
      seq = 5;
      const created = await service.createlink(OID(1), {
        name: 'Site',
        link: 'https://a.com',
        type: 'Link',
      });
      expect(created).toMatchObject({
        name: 'Site',
        link: 'https://a.com',
        type: 'Link',
        userId: OID(1),
        order: 5,
      });
    });

    it('seeds a new counter after the highest existing position, once', async () => {
      counterModel.exists.mockResolvedValue(null);
      linkModel.findOne.mockReturnValue(query({ order: 4 }));
      await service.createlink(OID(1), {
        name: 'Site',
        link: 'https://a.com',
        type: 'Link',
      });
      expect(counterModel.updateOne).toHaveBeenCalledWith(
        { _id: `link-order:${OID(1)}:main` },
        { $setOnInsert: { seq: 4 } },
        { upsert: true },
      );
    });

    it('two creations at the same time never share a position', async () => {
      const make = (n: number) =>
        service.createlink(OID(1), {
          name: `L${n}`,
          link: 'https://a.com',
          type: 'Link',
        });
      const all: any[] = await Promise.all([1, 2, 3, 4, 5].map(make));
      expect(new Set(all.map((l) => l.order)).size).toBe(5);
    });

    it('starts at order 0 for the first link', async () => {
      const created: any = await service.createlink(OID(1), {
        name: 'Site',
        link: 'https://a.com',
        type: 'Link',
      });
      expect(created.order).toBe(0);
    });

    it.each([
      ['Link', 'javascript:alert(1)'],
      ['Link', 'data:text/html,<script>1</script>'],
      ['Link', 'not a url'],
      ['Email', 'https://a.com'],
      ['Telefone', 'tel:abc'],
      ['Instagram', ''],
    ])(
      'rejects %s with link %p (400) and saves nothing',
      async (type, link) => {
        await expect(
          service.createlink(OID(1), { name: 'X', link, type }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(linkModel.create).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['Email', 'mailto:oi@x.com'],
      ['Telefone', 'tel:+5511999998888'],
      ['Whatsapp', 'https://wa.me/5511999998888'],
      ['Youtube', 'https://youtube.com/@canal'],
    ])('accepts %s with %s', async (type, link) => {
      linkModel.findOne.mockReturnValue(query(null));
      await expect(
        service.createlink(OID(1), { name: 'X', link, type }),
      ).resolves.toMatchObject({ type, link });
    });

    it('a header needs no URL and any URL sent is dropped', async () => {
      linkModel.findOne.mockReturnValue(query(null));
      const created: any = await service.createlink(OID(1), {
        name: 'Seção',
        type: 'Cabecalho',
        link: 'https://ignored.com',
      });
      expect(created.link).toBe('');
    });
  });

  describe('updateLink', () => {
    const owned = (type: string, extra: object = {}) => {
      const doc: any = {
        name: 'Velho',
        link: 'https://velho.com',
        type,
        save: jest.fn().mockImplementation(async function (this: any) {
          return this;
        }),
        ...extra,
      };
      linkModel.findOne.mockResolvedValue(doc);
      return doc;
    };

    it('changes the name and a valid link of the stored type', async () => {
      const doc = owned('Link');
      await service.updateLink(OID(1), {
        id: OID(2),
        name: 'Novo',
        link: 'https://novo.com',
      });
      expect(doc).toMatchObject({ name: 'Novo', link: 'https://novo.com' });
      expect(doc.save).toHaveBeenCalled();
    });

    it('validates the link by the stored type, not by what the client claims', async () => {
      const doc = owned('Email', { link: 'mailto:a@b.com' });
      await expect(
        service.updateLink(OID(1), { id: OID(2), link: 'https://x.com' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(doc.link).toBe('mailto:a@b.com');
      expect(doc.save).not.toHaveBeenCalled();
    });

    it('leaves a header without URL', async () => {
      const doc = owned('Cabecalho', { link: '' });
      await service.updateLink(OID(1), {
        id: OID(2),
        name: 'Outro título',
        link: 'https://x.com',
      });
      expect(doc.link).toBe('');
      expect(doc.name).toBe('Outro título');
    });

    it("reports someone else's (or a malformed) id as not found", async () => {
      linkModel.findOne.mockResolvedValue(null);
      await expect(
        service.updateLink(OID(1), { id: OID(2), name: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.updateLink(OID(1), { id: 'zzz', name: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(linkModel.findOne).toHaveBeenCalledTimes(1); // the malformed id never reaches the database
    });

    it('queries by id AND owner', async () => {
      linkModel.findOne.mockResolvedValue(null);
      await service
        .updateLink(OID(1), { id: OID(2), name: 'X' })
        .catch(() => undefined);
      expect(linkModel.findOne).toHaveBeenCalledWith({
        _id: OID(2),
        userId: OID(1),
      });
    });
  });

  describe('removelink / updateActive', () => {
    it('removes only a link of the owner', async () => {
      const doc = { deleteOne: jest.fn() };
      linkModel.findOne.mockResolvedValue(doc);
      await service.removelink(OID(1), OID(2));
      expect(doc.deleteOne).toHaveBeenCalled();
    });

    it("404 when the link is not the user's", async () => {
      linkModel.findOne.mockResolvedValue(null);
      await expect(service.removelink(OID(1), OID(2))).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(
        service.updateActive(OID(1), OID(2), false),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('toggles activation', async () => {
      const doc: any = {
        isActivit: true,
        save: jest.fn().mockResolvedValue('saved'),
      };
      linkModel.findOne.mockResolvedValue(doc);
      await service.updateActive(OID(1), OID(2), false);
      expect(doc.isActivit).toBe(false);
    });
  });

  describe('reorder', () => {
    // 1st count = owned ids, 2nd = links in the page, 3rd = sent ids that are in that page
    const counts = (owned: number, inPage: number, same: number) =>
      linkModel.countDocuments
        .mockResolvedValueOnce(owned)
        .mockResolvedValueOnce(inPage)
        .mockResolvedValueOnce(same);

    beforeEach(() => {
      linkModel.findOne.mockReturnValue(query({ pageId: null }));
    });

    it('writes order = position for every id', async () => {
      counts(3, 3, 3);
      await service.reorder(OID(1), [OID(10), OID(11), OID(12)]);
      const ops = linkModel.bulkWrite.mock.calls[0][0];
      expect(
        ops.map((o: any) => [
          o.updateOne.filter._id,
          o.updateOne.update.$set.order,
        ]),
      ).toEqual([
        [OID(10), 0],
        [OID(11), 1],
        [OID(12), 2],
      ]);
      expect(ops.every((o: any) => o.updateOne.filter.userId === OID(1))).toBe(
        true,
      );
    });

    it("rejects the whole list if any id is not the user's (404), writing nothing", async () => {
      linkModel.countDocuments.mockResolvedValueOnce(2); // 3 sent, 2 owned
      await expect(
        service.reorder(OID(1), [OID(10), OID(11), OID(12)]),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(linkModel.bulkWrite).not.toHaveBeenCalled();
    });

    it('does not count malformed ids as owned', async () => {
      linkModel.countDocuments.mockResolvedValueOnce(1);
      await expect(
        service.reorder(OID(1), [OID(10), 'nao-e-id']),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(linkModel.countDocuments.mock.calls[0][0]._id.$in).toEqual([
        OID(10),
      ]);
    });

    it('answers 409 when the list is stale (the page now has more links), writing nothing', async () => {
      counts(2, 3, 2); // client sent 2 ids, the page has 3 links now
      await expect(
        service.reorder(OID(1), [OID(10), OID(11)]),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(linkModel.bulkWrite).not.toHaveBeenCalled();
    });

    it('answers 409 when the ids mix links of different pages', async () => {
      counts(2, 2, 1);
      await expect(
        service.reorder(OID(1), [OID(10), OID(11)]),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findAllDataUserById (public page)', () => {
    const user = {
      _id: OID(5),
      name: 'Maria',
      username: 'maria',
      photoURL: '/media/x.png',
      template: '{}',
      title: 'T',
      about: 'A',
      socials: [{ network: 'instagram', url: 'https://instagram.com/m' }],
      email: 'segredo@x.com',
      password: 'hash',
    };

    it('finds by @username (case-insensitive) and returns no private data', async () => {
      userModel.findOne.mockResolvedValue(user);
      linkModel.find.mockReturnValue(query([{ name: 'L' }]));

      const page: any = await service.findAllDataUserById('@Maria');

      expect(userModel.findOne).toHaveBeenCalledWith({ username: 'maria' });
      expect(userModel.findById).not.toHaveBeenCalled();
      expect(page).toMatchObject({
        id: OID(5),
        username: 'maria',
        socials: user.socials,
        links: [{ name: 'L' }],
      });
      expect(JSON.stringify(page)).not.toContain('segredo');
      expect(JSON.stringify(page)).not.toContain('hash');
    });

    it('finds by id when it is an ObjectId', async () => {
      userModel.findById.mockResolvedValue(user);
      linkModel.find.mockReturnValue(query([]));
      await service.findAllDataUserById(OID(5));
      expect(userModel.findById).toHaveBeenCalledWith(OID(5));
    });

    it('only asks for active links', async () => {
      userModel.findOne.mockResolvedValue(user);
      linkModel.find.mockReturnValue(query([]));
      await service.findAllDataUserById('maria');
      expect(linkModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: OID(5),
          pageId: null,
          isActivit: true,
        }),
      );
    });

    it('404 for an unknown user', async () => {
      userModel.findOne.mockResolvedValue(null);
      await expect(
        service.findAllDataUserById('ninguem'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('extras: thumbnail, featured, schedule, embed, password', () => {
    const first = () => linkModel.findOne.mockReturnValue(query(null));

    it('accepts a thumbnail that is an image of the owner or a bundled asset', async () => {
      first();
      await expect(
        service.createlink(OID(1), {
          name: 'X',
          link: 'https://a.com',
          type: 'Link',
          thumbnail: `/media/${OID(1)}/a.png`,
          featured: true,
        }),
      ).resolves.toMatchObject({
        thumbnail: `/media/${OID(1)}/a.png`,
        featured: true,
      });
      await expect(
        service.createlink(OID(1), {
          name: 'X',
          link: 'https://a.com',
          type: 'Link',
          thumbnail: '/assets/avatars/avatar-01.svg',
        }),
      ).resolves.toBeTruthy();
    });

    it("rejects a thumbnail from someone else's folder or an external URL (400)", async () => {
      first();
      await expect(
        service.createlink(OID(1), {
          name: 'X',
          link: 'https://a.com',
          type: 'Link',
          thumbnail: `/media/${OID(2)}/a.png`,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.createlink(OID(1), {
          name: 'X',
          link: 'https://a.com',
          type: 'Link',
          thumbnail: 'https://evil.com/x.png',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('stores the schedule and refuses an end before the start', async () => {
      first();
      const ok: any = await service.createlink(OID(1), {
        name: 'X',
        link: 'https://a.com',
        type: 'Link',
        startAt: '2030-01-01T00:00:00Z',
        endAt: '2030-02-01T00:00:00Z',
      });
      expect(ok.startAt).toEqual(new Date('2030-01-01T00:00:00Z'));
      await expect(
        service.createlink(OID(1), {
          name: 'X',
          link: 'https://a.com',
          type: 'Link',
          startAt: '2030-02-01T00:00:00Z',
          endAt: '2030-01-01T00:00:00Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('embed needs a YouTube/Spotify link that has a player', async () => {
      first();
      await expect(
        service.createlink(OID(1), {
          name: 'V',
          link: 'https://youtu.be/dQw4w9WgXcQ',
          type: 'Youtube',
          embed: true,
        }),
      ).resolves.toMatchObject({ embed: true });
      await expect(
        service.createlink(OID(1), {
          name: 'V',
          link: 'https://youtube.com/@canal',
          type: 'Youtube',
          embed: true,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.createlink(OID(1), {
          name: 'V',
          link: 'https://a.com',
          type: 'Link',
          embed: true,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('hashes the password (never stored in clear) and marks the link locked', async () => {
      first();
      const created: any = await service.createlink(OID(1), {
        name: 'VIP',
        link: 'https://a.com/vip',
        type: 'Link',
        password: 'segredo-1',
      });
      expect(created.locked).toBe(true);
      expect(created.passwordHash).not.toBe('segredo-1');
      expect(await bcrypt.compare('segredo-1', created.passwordHash)).toBe(
        true,
      );
    });

    it('a header cannot have a password', async () => {
      first();
      await expect(
        service.createlink(OID(1), {
          name: 'Seção',
          type: 'Cabecalho',
          password: 'segredo-1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('an e-mail form and a Pix key are valid link types', async () => {
      first();
      await expect(
        service.createlink(OID(1), { name: 'Newsletter', type: 'Newsletter' }),
      ).resolves.toMatchObject({ link: '' });
      await expect(
        service.createlink(OID(1), {
          name: 'Pix',
          link: 'maria@x.com',
          type: 'Pix',
        }),
      ).resolves.toMatchObject({ link: 'maria@x.com' });
    });

    it('editing: sets, changes and clears the extras; removePassword unlocks', async () => {
      const doc: any = {
        name: 'N',
        link: 'https://a.com',
        type: 'Link',
        embed: false,
        locked: true,
        passwordHash: 'h',
        startAt: null,
        endAt: null,
        save: jest.fn().mockImplementation(async function (this: any) {
          return this;
        }),
      };
      linkModel.findOne.mockResolvedValue(doc);
      await service.updateLink(OID(1), {
        id: OID(2),
        featured: true,
        thumbnail: null,
        startAt: '2030-01-01T00:00:00Z',
        removePassword: true,
      });
      expect(doc).toMatchObject({
        featured: true,
        thumbnail: null,
        locked: false,
      });
      expect(doc.passwordHash).toBeUndefined();
      expect(doc.startAt).toEqual(new Date('2030-01-01T00:00:00Z'));
    });

    it('editing: the new end must come after the stored start', async () => {
      const doc: any = {
        name: 'N',
        link: 'https://a.com',
        type: 'Link',
        startAt: new Date('2030-03-01'),
        endAt: null,
        save: jest.fn(),
      };
      linkModel.findOne.mockResolvedValue(doc);
      await expect(
        service.updateLink(OID(1), {
          id: OID(2),
          endAt: '2030-01-01T00:00:00Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(doc.save).not.toHaveBeenCalled();
    });

    it('editing the URL of an embedded link to one without player turns the embed off', async () => {
      const doc: any = {
        name: 'N',
        link: 'https://youtu.be/dQw4w9WgXcQ',
        type: 'Youtube',
        embed: true,
        save: jest.fn().mockImplementation(async function (this: any) {
          return this;
        }),
      };
      linkModel.findOne.mockResolvedValue(doc);
      await service.updateLink(OID(1), {
        id: OID(2),
        link: 'https://youtube.com/@canal',
      });
      expect(doc.embed).toBe(false);
    });
  });

  describe('extra pages', () => {
    it('creates a link on an extra page only if the page belongs to the user', async () => {
      linkModel.findOne.mockReturnValue(query(null));
      pageModel.exists.mockResolvedValue(null);
      await expect(
        service.createlink(OID(1), {
          name: 'X',
          link: 'https://a.com',
          type: 'Link',
          pageId: OID(7),
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      pageModel.exists.mockResolvedValue({ _id: OID(7) });
      const created: any = await service.createlink(OID(1), {
        name: 'X',
        link: 'https://a.com',
        type: 'Link',
        pageId: OID(7),
      });
      expect(String(created.pageId)).toBe(OID(7));
      // the position counter is per page
      expect(counterModel.findOneAndUpdate).toHaveBeenLastCalledWith(
        { _id: `link-order:${OID(1)}:${OID(7)}` },
        { $inc: { seq: 1 } },
        { new: true },
      );
    });

    it('public: an @username that is not a user resolves to an extra page and lists only its links', async () => {
      userModel.findOne.mockResolvedValue(null);
      pageModel.findOne.mockResolvedValue({
        _id: OID(7),
        userId: OID(1),
        name: 'Loja',
        username: 'loja',
        socials: [],
        pixels: { meta: '123456' },
      });
      linkModel.find.mockReturnValue(query([]));
      const page: any = await service.findAllDataUserById('@loja');
      expect(page).toMatchObject({
        id: OID(7),
        username: 'loja',
        pixels: { meta: '123456' },
      });
      const q = linkModel.find.mock.calls[0][0];
      expect(q.userId).toBe(OID(1));
      expect(String(q.pageId)).toBe(OID(7));
    });
  });

  describe('public page: schedule and protected links', () => {
    const owner = {
      _id: OID(5),
      name: 'M',
      username: 'm',
      socials: [],
      pixels: {},
    };

    it('asks only for links inside their schedule window', async () => {
      userModel.findOne.mockResolvedValue(owner);
      linkModel.find.mockReturnValue(query([]));
      await service.findAllDataUserById('m');
      const q = linkModel.find.mock.calls[0][0];
      expect(q.isActivit).toBe(true);
      expect(q.$and).toHaveLength(2);
      expect(q.$and[0].$or).toEqual(
        expect.arrayContaining([
          { startAt: null },
          { startAt: { $lte: expect.any(Date) } },
        ]),
      );
      expect(q.$and[1].$or).toEqual(
        expect.arrayContaining([
          { endAt: null },
          { endAt: { $gt: expect.any(Date) } },
        ]),
      );
    });

    it('never sends the destination or the hash of a protected link', async () => {
      userModel.findOne.mockResolvedValue(owner);
      linkModel.find.mockReturnValue(
        query([
          {
            toJSON: () => ({
              id: 'l1',
              name: 'VIP',
              link: 'https://segredo.com',
              type: 'Link',
              locked: true,
              passwordHash: 'h',
              userId: OID(5),
              embed: false,
            }),
          },
          {
            toJSON: () => ({
              id: 'l2',
              name: 'Aberto',
              link: 'https://aberto.com',
              type: 'Link',
              locked: false,
              userId: OID(5),
              embed: false,
            }),
          },
        ]),
      );
      const page: any = await service.findAllDataUserById('m');
      const json = JSON.stringify(page);
      expect(json).not.toContain('segredo.com');
      expect(json).not.toContain('passwordHash');
      expect(page.links[0]).toMatchObject({ locked: true, link: '' });
      expect(page.links[1].link).toBe('https://aberto.com');
    });

    it('adds the player URL of embedded links (and hides it when locked)', async () => {
      userModel.findOne.mockResolvedValue(owner);
      linkModel.find.mockReturnValue(
        query([
          {
            toJSON: () => ({
              id: 'a',
              name: 'V',
              link: 'https://youtu.be/dQw4w9WgXcQ',
              type: 'Youtube',
              embed: true,
              locked: false,
            }),
          },
          {
            toJSON: () => ({
              id: 'b',
              name: 'S',
              link: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
              type: 'Spotify',
              embed: true,
              locked: true,
            }),
          },
        ]),
      );
      const page: any = await service.findAllDataUserById('m');
      expect(page.links[0].embedUrl).toBe(
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      );
      expect(page.links[1].embedUrl).toBeNull();
    });
  });

  describe('unlock', () => {
    const lockedLink = async () => ({
      link: 'https://segredo.com',
      passwordHash: await bcrypt.hash('certa-123', 4),
    });

    it('reveals the destination for the right password', async () => {
      linkModel.findOne.mockReturnValue(query(await lockedLink()));
      await expect(service.unlock(OID(9), 'certa-123')).resolves.toEqual({
        link: 'https://segredo.com',
      });
    });

    it('401 for a wrong password, unknown link or a link that is not locked', async () => {
      linkModel.findOne.mockReturnValue(query(await lockedLink()));
      await expect(service.unlock(OID(9), 'errada')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      linkModel.findOne.mockReturnValue(query(null));
      await expect(service.unlock(OID(9), 'qualquer')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('blocks a link after 5 wrong tries (429), even with the right password', async () => {
      linkModel.findOne.mockReturnValue(query(await lockedLink()));
      for (let i = 0; i < 5; i++)
        await service.unlock(OID(9), 'errada').catch(() => undefined);
      const blocked: any = await service
        .unlock(OID(9), 'certa-123')
        .catch((e) => e);
      expect(blocked.getStatus()).toBe(429);
    });
  });
});
