import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { query } from '../test-utils';
import { MAX_EXTRA_PAGES, PagesService } from './pages.service';

const OID = (n: number) => n.toString(16).padStart(24, '0');

describe('PagesService', () => {
  let pages: Record<string, jest.Mock>;
  let users: Record<string, jest.Mock>;
  let links: Record<string, jest.Mock>;
  let leads: Record<string, jest.Mock>;
  let events: Record<string, jest.Mock>;
  let handles: Record<string, jest.Mock>;
  let service: PagesService;
  const owned = (extra: object = {}) => {
    const doc: any = {
      _id: OID(7),
      userId: OID(1),
      name: 'Loja',
      toJSON: () => ({ id: OID(7), name: 'Loja' }),
      deleteOne: jest.fn(),
      ...extra,
    };
    pages.findOne.mockResolvedValue(doc);
    return doc;
  };

  beforeEach(() => {
    pages = {
      countDocuments: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(async (d) => d),
      findOne: jest.fn(),
      findByIdAndUpdate: jest.fn().mockResolvedValue({}),
    };
    users = { exists: jest.fn().mockResolvedValue(null) };
    links = { find: jest.fn(), deleteMany: jest.fn() };
    leads = { deleteMany: jest.fn() };
    events = { deleteMany: jest.fn() };
    handles = {
      rename: jest.fn((_o, _n, _c, apply) => apply()),
      release: jest.fn(),
    };
    service = new PagesService(
      pages as any,
      users as any,
      links as any,
      leads as any,
      events as any,
      handles as any,
    );
  });

  it('creates a page for the user and limits how many they can have', async () => {
    await expect(
      service.create(OID(1), { name: ' Loja ' }),
    ).resolves.toMatchObject({ userId: OID(1), name: 'Loja', title: 'Loja' });
    pages.countDocuments.mockResolvedValue(MAX_EXTRA_PAGES);
    await expect(
      service.create(OID(1), { name: 'Outra' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns the page with its own links only', async () => {
    owned();
    links.find.mockReturnValue(query([{ name: 'L' }]));
    const page: any = await service.findOne(OID(1), OID(7));
    expect(links.find).toHaveBeenCalledWith({ userId: OID(1), pageId: OID(7) });
    expect(page).toMatchObject({ id: OID(7), links: [{ name: 'L' }] });
  });

  it("someone else's or a malformed page id is 404", async () => {
    pages.findOne.mockResolvedValue(null);
    await expect(service.findOne(OID(1), OID(7))).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.findOne(OID(1), 'xx')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.edit(OID(1), { id: OID(7), title: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(OID(1), OID(7))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('edits with the same rules as the main page', async () => {
    owned();
    await expect(
      service.edit(OID(1), { id: OID(7), username: 'login' }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.edit(OID(1), {
        id: OID(7),
        socials: [{ network: 'instagram', url: 'javascript:1' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    users.exists.mockResolvedValue({ _id: 'u' }); // handle already used by a user
    await expect(
      service.edit(OID(1), { id: OID(7), username: 'maria' }),
    ).rejects.toBeInstanceOf(ConflictException);

    users.exists.mockResolvedValue(null);
    await service.edit(OID(1), {
      id: OID(7),
      title: 'Nova',
      username: 'loja',
      pixels: { ga: 'G-ABC123', meta: '' },
    });
    expect(pages.findByIdAndUpdate).toHaveBeenCalledWith(
      OID(7),
      { title: 'Nova', username: 'loja', pixels: { ga: 'G-ABC123' } },
      { new: true },
    );
  });

  it('turns a duplicate username (unique index) into 409', async () => {
    owned();
    pages.findByIdAndUpdate.mockRejectedValue({ code: 11000 });
    await expect(
      service.edit(OID(1), { id: OID(7), username: 'loja' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('deleting a page removes its links, contacts and events too', async () => {
    const doc = owned();
    await service.remove(OID(1), OID(7));
    for (const model of [links, leads, events]) {
      expect(model.deleteMany).toHaveBeenCalledWith({
        userId: OID(1),
        pageId: OID(7),
      });
    }
    expect(doc.deleteOne).toHaveBeenCalled();
  });
});
