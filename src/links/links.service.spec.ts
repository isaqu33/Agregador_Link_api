import { BadRequestException, NotFoundException } from '@nestjs/common';
import { query } from '../test-utils';
import { LinksService } from './links.service';

const OID = (n: number) => n.toString(16).padStart(24, '0'); // valid ObjectId strings

describe('LinksService', () => {
  let linkModel: Record<string, jest.Mock>;
  let userModel: Record<string, jest.Mock>;
  let service: LinksService;

  beforeEach(() => {
    linkModel = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation(async (doc) => doc),
      countDocuments: jest.fn(),
      bulkWrite: jest.fn().mockResolvedValue({}),
    };
    userModel = { findById: jest.fn(), findOne: jest.fn() };
    service = new LinksService(linkModel as any, userModel as any);
  });

  describe('createlink', () => {
    it('puts the new link at the end of the list', async () => {
      linkModel.findOne.mockReturnValue(query({ order: 4 }));
      const created = await service.createlink(OID(1), { name: 'Site', link: 'https://a.com', type: 'Link' });
      expect(created).toMatchObject({ name: 'Site', link: 'https://a.com', type: 'Link', userId: OID(1), order: 5 });
    });

    it('starts at order 0 for the first link', async () => {
      linkModel.findOne.mockReturnValue(query(null));
      const created: any = await service.createlink(OID(1), { name: 'Site', link: 'https://a.com', type: 'Link' });
      expect(created.order).toBe(0);
    });

    it.each([
      ['Link', 'javascript:alert(1)'],
      ['Link', 'data:text/html,<script>1</script>'],
      ['Link', 'not a url'],
      ['Email', 'https://a.com'],
      ['Telefone', 'tel:abc'],
      ['Instagram', ''],
    ])('rejects %s with link %p (400) and saves nothing', async (type, link) => {
      await expect(service.createlink(OID(1), { name: 'X', link, type })).rejects.toBeInstanceOf(BadRequestException);
      expect(linkModel.create).not.toHaveBeenCalled();
    });

    it.each([
      ['Email', 'mailto:oi@x.com'],
      ['Telefone', 'tel:+5511999998888'],
      ['Whatsapp', 'https://wa.me/5511999998888'],
      ['Youtube', 'https://youtube.com/@canal'],
    ])('accepts %s with %s', async (type, link) => {
      linkModel.findOne.mockReturnValue(query(null));
      await expect(service.createlink(OID(1), { name: 'X', link, type })).resolves.toMatchObject({ type, link });
    });

    it('a header needs no URL and any URL sent is dropped', async () => {
      linkModel.findOne.mockReturnValue(query(null));
      const created: any = await service.createlink(OID(1), { name: 'Seção', type: 'Cabecalho', link: 'https://ignored.com' });
      expect(created.link).toBe('');
    });
  });

  describe('updateLink', () => {
    const owned = (type: string, extra: object = {}) => {
      const doc: any = { name: 'Velho', link: 'https://velho.com', type, save: jest.fn().mockImplementation(async function (this: any) { return this; }), ...extra };
      linkModel.findOne.mockResolvedValue(doc);
      return doc;
    };

    it('changes the name and a valid link of the stored type', async () => {
      const doc = owned('Link');
      await service.updateLink(OID(1), { id: OID(2), name: 'Novo', link: 'https://novo.com' });
      expect(doc).toMatchObject({ name: 'Novo', link: 'https://novo.com' });
      expect(doc.save).toHaveBeenCalled();
    });

    it('validates the link by the stored type, not by what the client claims', async () => {
      const doc = owned('Email', { link: 'mailto:a@b.com' });
      await expect(service.updateLink(OID(1), { id: OID(2), link: 'https://x.com' })).rejects.toBeInstanceOf(BadRequestException);
      expect(doc.link).toBe('mailto:a@b.com');
      expect(doc.save).not.toHaveBeenCalled();
    });

    it('leaves a header without URL', async () => {
      const doc = owned('Cabecalho', { link: '' });
      await service.updateLink(OID(1), { id: OID(2), name: 'Outro título', link: 'https://x.com' });
      expect(doc.link).toBe('');
      expect(doc.name).toBe('Outro título');
    });

    it('reports someone else\'s (or a malformed) id as not found', async () => {
      linkModel.findOne.mockResolvedValue(null);
      await expect(service.updateLink(OID(1), { id: OID(2), name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.updateLink(OID(1), { id: 'zzz', name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
      expect(linkModel.findOne).toHaveBeenCalledTimes(1); // the malformed id never reaches the database
    });

    it('queries by id AND owner', async () => {
      linkModel.findOne.mockResolvedValue(null);
      await service.updateLink(OID(1), { id: OID(2), name: 'X' }).catch(() => undefined);
      expect(linkModel.findOne).toHaveBeenCalledWith({ _id: OID(2), userId: OID(1) });
    });
  });

  describe('removelink / updateActive', () => {
    it('removes only a link of the owner', async () => {
      const doc = { deleteOne: jest.fn() };
      linkModel.findOne.mockResolvedValue(doc);
      await service.removelink(OID(1), OID(2));
      expect(doc.deleteOne).toHaveBeenCalled();
    });

    it('404 when the link is not the user\'s', async () => {
      linkModel.findOne.mockResolvedValue(null);
      await expect(service.removelink(OID(1), OID(2))).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.updateActive(OID(1), OID(2), false)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('toggles activation', async () => {
      const doc: any = { isActivit: true, save: jest.fn().mockResolvedValue('saved') };
      linkModel.findOne.mockResolvedValue(doc);
      await service.updateActive(OID(1), OID(2), false);
      expect(doc.isActivit).toBe(false);
    });
  });

  describe('reorder', () => {
    it('writes order = position for every id', async () => {
      linkModel.countDocuments.mockResolvedValue(3);
      await service.reorder(OID(1), [OID(10), OID(11), OID(12)]);
      const ops = linkModel.bulkWrite.mock.calls[0][0];
      expect(ops.map((o: any) => [o.updateOne.filter._id, o.updateOne.update.$set.order])).toEqual([
        [OID(10), 0],
        [OID(11), 1],
        [OID(12), 2],
      ]);
      expect(ops.every((o: any) => o.updateOne.filter.userId === OID(1))).toBe(true);
    });

    it('rejects the whole list if any id is not the user\'s (404), writing nothing', async () => {
      linkModel.countDocuments.mockResolvedValue(2); // 3 sent, 2 owned
      await expect(service.reorder(OID(1), [OID(10), OID(11), OID(12)])).rejects.toBeInstanceOf(NotFoundException);
      expect(linkModel.bulkWrite).not.toHaveBeenCalled();
    });

    it('does not count malformed ids as owned', async () => {
      linkModel.countDocuments.mockResolvedValue(1);
      await expect(service.reorder(OID(1), [OID(10), 'nao-e-id'])).rejects.toBeInstanceOf(NotFoundException);
      expect(linkModel.countDocuments.mock.calls[0][0]._id.$in).toEqual([OID(10)]);
    });
  });

  describe('findAllDataUserById (public page)', () => {
    const user = {
      _id: OID(5), name: 'Maria', username: 'maria', photoURL: '/media/x.png', template: '{}', title: 'T', about: 'A',
      socials: [{ network: 'instagram', url: 'https://instagram.com/m' }], email: 'segredo@x.com', password: 'hash',
    };

    it('finds by @username (case-insensitive) and returns no private data', async () => {
      userModel.findOne.mockResolvedValue(user);
      linkModel.find.mockReturnValue(query([{ name: 'L' }]));

      const page: any = await service.findAllDataUserById('@Maria');

      expect(userModel.findOne).toHaveBeenCalledWith({ username: 'maria' });
      expect(userModel.findById).not.toHaveBeenCalled();
      expect(page).toMatchObject({ id: OID(5), username: 'maria', socials: user.socials, links: [{ name: 'L' }] });
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
      expect(linkModel.find).toHaveBeenCalledWith({ userId: OID(5), isActivit: true });
    });

    it('404 for an unknown user', async () => {
      userModel.findOne.mockResolvedValue(null);
      await expect(service.findAllDataUserById('ninguem')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
