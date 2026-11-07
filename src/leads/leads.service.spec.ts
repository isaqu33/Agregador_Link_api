import { BadRequestException, NotFoundException } from '@nestjs/common';
import { query } from '../test-utils';
import { LeadsService } from './leads.service';

const OID = (n: number) => n.toString(16).padStart(24, '0');

describe('LeadsService', () => {
  let leadModel: Record<string, jest.Mock>;
  let linkModel: Record<string, jest.Mock>;
  let service: LeadsService;

  beforeEach(() => {
    leadModel = {
      updateOne: jest.fn().mockResolvedValue({}),
      find: jest.fn(),
      deleteOne: jest.fn(),
      countDocuments: jest.fn().mockResolvedValue(1),
    };
    linkModel = { findOne: jest.fn(), find: jest.fn() };
    service = new LeadsService(leadModel as any, linkModel as any);
  });

  it('stores a lead for an active e-mail form, attributed to the page owner', async () => {
    linkModel.findOne.mockReturnValue(
      query({ _id: OID(9), userId: OID(1), pageId: OID(7) }),
    );
    await expect(
      service.capture({ linkId: OID(9), email: ' Ana@X.com ', name: ' Ana ' }),
    ).resolves.toEqual({ ok: true });
    expect(linkModel.findOne).toHaveBeenCalledWith({
      _id: OID(9),
      isActivit: true,
      type: 'Newsletter',
    });
    const [filter, update, opts] = leadModel.updateOne.mock.calls[0];
    expect(filter).toEqual({ linkId: OID(9), email: 'ana@x.com' });
    expect(update.$setOnInsert).toEqual({
      userId: OID(1),
      pageId: OID(7),
      name: 'Ana',
    });
    expect(opts).toEqual({ upsert: true });
  });

  it('upserts: the same e-mail in the same form is not duplicated', async () => {
    linkModel.findOne.mockReturnValue(query({ _id: OID(9), userId: OID(1) }));
    await service.capture({ linkId: OID(9), email: 'a@x.com' });
    await service.capture({ linkId: OID(9), email: 'A@X.com' });
    expect(leadModel.updateOne.mock.calls.map((c) => c[0])).toEqual([
      { linkId: OID(9), email: 'a@x.com' },
      { linkId: OID(9), email: 'a@x.com' },
    ]);
  });

  it('ignores the honeypot and unknown/inactive/non-form links, answering ok anyway', async () => {
    await expect(
      service.capture({
        linkId: OID(9),
        email: 'a@x.com',
        website: 'http://spam.com',
      }),
    ).resolves.toEqual({ ok: true });
    expect(linkModel.findOne).not.toHaveBeenCalled();

    linkModel.findOne.mockReturnValue(query(null));
    await expect(
      service.capture({ linkId: OID(9), email: 'a@x.com' }),
    ).resolves.toEqual({ ok: true });
    expect(leadModel.updateOne).not.toHaveBeenCalled();
  });

  it("lists only the owner's leads of that page, with the form name", async () => {
    leadModel.find.mockReturnValue(
      query([
        {
          _id: OID(3),
          email: 'a@x.com',
          name: 'A',
          linkId: OID(9),
          createdAt: new Date('2026-01-01'),
        },
      ]),
    );
    linkModel.find.mockReturnValue(
      query([{ _id: OID(9), name: 'Newsletter' }]),
    );
    const res = await service.list(OID(1));
    expect(leadModel.find).toHaveBeenCalledWith({
      userId: OID(1),
      pageId: null,
    });
    expect(res.leads[0]).toMatchObject({
      email: 'a@x.com',
      form: 'Newsletter',
    });

    await service.list(OID(1), OID(7));
    expect(String(leadModel.find.mock.calls[1][0].pageId)).toBe(OID(7));
  });

  describe('cursor pagination', () => {
    const rows = (ids: number[]) =>
      ids.map((n) => ({
        _id: OID(n),
        email: `p${n}@x.com`,
        linkId: OID(9),
        createdAt: new Date(),
      }));

    beforeEach(() => {
      linkModel.find.mockReturnValue(query([{ _id: OID(9), name: 'F' }]));
      leadModel.countDocuments.mockResolvedValue(7);
    });

    it('asks for one row more than the limit to know if there is a next page', async () => {
      const q = query(rows([30, 29, 28]));
      const limit = jest.spyOn(q, 'limit');
      leadModel.find.mockReturnValue(q);
      const res = await service.list(OID(1), undefined, { limit: 2 });
      expect(limit).toHaveBeenCalledWith(3);
      expect(res.leads).toHaveLength(2);
      expect(res.nextCursor).toBe(OID(29));
      expect(res.total).toBe(7);
    });

    it('the last page has no cursor', async () => {
      leadModel.find.mockReturnValue(query(rows([2, 1])));
      const res = await service.list(OID(1), undefined, { limit: 5 });
      expect(res.nextCursor).toBeNull();
    });

    it('the cursor means "older than this id"', async () => {
      leadModel.find.mockReturnValue(query([]));
      await service.list(OID(1), undefined, { cursor: OID(29) });
      const filter = leadModel.find.mock.calls[0][0];
      expect(String(filter._id.$lt)).toBe(OID(29));
    });

    it('rejects a malformed cursor (400) and clamps the limit', async () => {
      await expect(
        service.list(OID(1), undefined, { cursor: 'xx' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      const q = query([]);
      const limit = jest.spyOn(q, 'limit');
      leadModel.find.mockReturnValue(q);
      await service.list(OID(1), undefined, { limit: 99999 });
      expect(limit).toHaveBeenCalledWith(201);
    });
  });

  it('removes only a lead of the owner (404 otherwise)', async () => {
    leadModel.deleteOne
      .mockResolvedValueOnce({ deletedCount: 1 })
      .mockResolvedValueOnce({ deletedCount: 0 });
    await expect(service.remove(OID(1), OID(3))).resolves.toEqual({ ok: true });
    expect(leadModel.deleteOne).toHaveBeenCalledWith({
      _id: OID(3),
      userId: OID(1),
    });
    await expect(service.remove(OID(1), OID(3))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('exports CSV, neutralising spreadsheet formulas in names', async () => {
    leadModel.find.mockReturnValue(
      query([
        {
          _id: OID(3),
          email: 'a@x.com',
          name: '=cmd|calc',
          linkId: OID(9),
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
      ]),
    );
    linkModel.find.mockReturnValue(query([{ _id: OID(9), name: 'Lista' }]));
    const csv = await service.exportCsv(OID(1));
    expect(csv.split('\r\n')[0]).toBe('﻿email;nome;formulario;data');
    expect(csv).toContain("'=cmd|calc");
    expect(csv).toContain('2026-01-01T00:00:00.000Z');
  });
});
