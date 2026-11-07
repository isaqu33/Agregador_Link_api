import { ConflictException } from '@nestjs/common';
import { HandlesService } from './handles.service';

describe('HandlesService', () => {
  let handleModel: Record<string, jest.Mock>;
  let service: HandlesService;

  beforeEach(() => {
    handleModel = {
      create: jest.fn().mockResolvedValue({}),
      findById: jest.fn(),
      deleteOne: jest.fn().mockResolvedValue({}),
    };
    service = new HandlesService(handleModel as any, {} as any, {} as any);
  });

  describe('claim', () => {
    it('takes a free name', async () => {
      await service.claim('maria', 'u1');
      expect(handleModel.create).toHaveBeenCalledWith({
        _id: 'maria',
        ownerId: 'u1',
      });
    });

    it('409 when another owner holds it (duplicate key on _id)', async () => {
      handleModel.create.mockRejectedValue({ code: 11000 });
      handleModel.findById.mockResolvedValue({ ownerId: 'outro' });
      await expect(service.claim('maria', 'u1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('claiming your own name again is fine', async () => {
      handleModel.create.mockRejectedValue({ code: 11000 });
      handleModel.findById.mockResolvedValue({ ownerId: 'u1' });
      await expect(service.claim('maria', 'u1')).resolves.toBeUndefined();
    });

    it('other database errors are not hidden', async () => {
      handleModel.create.mockRejectedValue(new Error('boom'));
      await expect(service.claim('maria', 'u1')).rejects.toThrow('boom');
    });
  });

  describe('rename', () => {
    it('claims the new name, applies the update, then releases the old one', async () => {
      const order: string[] = [];
      handleModel.create.mockImplementation(async () => order.push('claim'));
      handleModel.deleteOne.mockImplementation(async () =>
        order.push('release'),
      );
      const result = await service.rename('u1', 'novo', 'velho', async () => {
        order.push('apply');
        return 'ok';
      });
      expect(result).toBe('ok');
      expect(order).toEqual(['claim', 'apply', 'release']);
      expect(handleModel.deleteOne).toHaveBeenCalledWith({
        _id: 'velho',
        ownerId: 'u1',
      });
    });

    it('does nothing with claims when the username is not changing', async () => {
      await service.rename('u1', undefined, 'velho', async () => 1);
      await service.rename('u1', 'velho', 'velho', async () => 1);
      expect(handleModel.create).not.toHaveBeenCalled();
      expect(handleModel.deleteOne).not.toHaveBeenCalled();
    });

    it('gives the new name back if the update fails, and keeps the old one', async () => {
      await expect(
        service.rename('u1', 'novo', 'velho', async () => {
          throw new Error('falhou');
        }),
      ).rejects.toThrow('falhou');
      expect(handleModel.deleteOne).toHaveBeenCalledTimes(1);
      expect(handleModel.deleteOne).toHaveBeenCalledWith({
        _id: 'novo',
        ownerId: 'u1',
      });
    });

    it('a name held by someone else stops everything before the update runs', async () => {
      handleModel.create.mockRejectedValue({ code: 11000 });
      handleModel.findById.mockResolvedValue({ ownerId: 'outro' });
      const apply = jest.fn();
      await expect(
        service.rename('u1', 'novo', 'velho', apply),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(apply).not.toHaveBeenCalled();
    });
  });
});
