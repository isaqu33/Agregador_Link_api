import { BadRequestException, ConflictException } from '@nestjs/common';
import { query } from '../test-utils';
import { UserService } from './user.service';

describe('UserService.editProfireUser', () => {
  let users: Record<string, jest.Mock>;
  let pages: Record<string, jest.Mock>;
  let handles: Record<string, jest.Mock>;
  let service: UserService;

  beforeEach(() => {
    users = {
      findByIdAndUpdate: jest.fn().mockResolvedValue({}),
      findById: jest.fn().mockReturnValue(query({ username: 'antigo' })),
    };
    pages = { exists: jest.fn().mockResolvedValue(null) };
    handles = { rename: jest.fn((_o, _n, _c, apply) => apply()) };
    service = new UserService(
      users as any,
      {} as any,
      pages as any,
      handles as any,
    );
  });

  it('only sends the fields that were provided', async () => {
    await service.editProfireUser('u1', { title: 'Novo' });
    expect(users.findByIdAndUpdate).toHaveBeenCalledWith(
      'u1',
      { title: 'Novo' },
      { new: true },
    );
  });

  it.each(['login', 'costumer', 'api', 'u', 'admin'])(
    'refuses the reserved username %s (409)',
    async (username) => {
      await expect(
        service.editProfireUser('u1', { username }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(users.findByIdAndUpdate).not.toHaveBeenCalled();
    },
  );

  it('refuses a username already used by an extra page (409)', async () => {
    pages.exists.mockResolvedValue({ _id: 'p1' });
    await expect(
      service.editProfireUser('u1', { username: 'loja' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(users.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('renames through the claim: new name, current name, then the update', async () => {
    await service.editProfireUser('u1', { username: 'maria' });
    expect(handles.rename).toHaveBeenCalledWith(
      'u1',
      'maria',
      'antigo',
      expect.any(Function),
    );
  });

  it('does not touch claims when the username is not being changed', async () => {
    await service.editProfireUser('u1', { title: 'x' });
    expect(users.findById).not.toHaveBeenCalled();
  });

  it('stores pixels without empty ids', async () => {
    await service.editProfireUser('u1', { pixels: { meta: '123456', ga: '' } });
    expect(users.findByIdAndUpdate).toHaveBeenCalledWith(
      'u1',
      { pixels: { meta: '123456' } },
      { new: true },
    );
  });

  it('turns a duplicate username (unique index) into 409', async () => {
    users.findByIdAndUpdate.mockRejectedValue({ code: 11000 });
    await expect(
      service.editProfireUser('u1', { username: 'maria' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lets other database errors through', async () => {
    users.findByIdAndUpdate.mockRejectedValue(new Error('boom'));
    await expect(
      service.editProfireUser('u1', { username: 'maria' }),
    ).rejects.toThrow('boom');
  });

  it('rejects a social link with a dangerous or wrong URL (400)', async () => {
    await expect(
      service.editProfireUser('u1', {
        socials: [{ network: 'instagram', url: 'javascript:alert(1)' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.editProfireUser('u1', {
        socials: [{ network: 'email', url: 'https://x.com' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(users.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('saves valid socials', async () => {
    const socials = [
      { network: 'instagram', url: 'https://instagram.com/m' },
      { network: 'email', url: 'mailto:a@b.com' },
    ];
    await service.editProfireUser('u1', { socials });
    expect(users.findByIdAndUpdate).toHaveBeenCalledWith(
      'u1',
      { socials },
      { new: true },
    );
  });
});
