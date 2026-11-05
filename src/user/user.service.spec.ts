import { BadRequestException, ConflictException } from '@nestjs/common';
import { UserService } from './user.service';

describe('UserService.editProfireUser', () => {
  let users: Record<string, jest.Mock>;
  let service: UserService;

  beforeEach(() => {
    users = { findByIdAndUpdate: jest.fn().mockResolvedValue({}) };
    service = new UserService(users as any, {} as any);
  });

  it('only sends the fields that were provided', async () => {
    await service.editProfireUser('u1', { title: 'Novo' });
    expect(users.findByIdAndUpdate).toHaveBeenCalledWith('u1', { title: 'Novo' }, { new: true });
  });

  it.each(['login', 'costumer', 'api', 'u', 'admin'])('refuses the reserved username %s (409)', async (username) => {
    await expect(service.editProfireUser('u1', { username })).rejects.toBeInstanceOf(ConflictException);
    expect(users.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('turns a duplicate username (unique index) into 409', async () => {
    users.findByIdAndUpdate.mockRejectedValue({ code: 11000 });
    await expect(service.editProfireUser('u1', { username: 'maria' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('lets other database errors through', async () => {
    users.findByIdAndUpdate.mockRejectedValue(new Error('boom'));
    await expect(service.editProfireUser('u1', { username: 'maria' })).rejects.toThrow('boom');
  });

  it('rejects a social link with a dangerous or wrong URL (400)', async () => {
    await expect(service.editProfireUser('u1', { socials: [{ network: 'instagram', url: 'javascript:alert(1)' }] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.editProfireUser('u1', { socials: [{ network: 'email', url: 'https://x.com' }] })).rejects.toBeInstanceOf(BadRequestException);
    expect(users.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('saves valid socials', async () => {
    const socials = [{ network: 'instagram', url: 'https://instagram.com/m' }, { network: 'email', url: 'mailto:a@b.com' }];
    await service.editProfireUser('u1', { socials });
    expect(users.findByIdAndUpdate).toHaveBeenCalledWith('u1', { socials }, { new: true });
  });
});
