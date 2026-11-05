import { BadRequestException, ConflictException, HttpException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { CacheService } from '../cache/cache.service';
import { configStub } from '../test-utils';
import { AuthService, MAX_LOGIN_FAILURES } from './auth.service';

describe('AuthService', () => {
  let users: Record<string, jest.Mock>;
  let jwt: { login: jest.Mock };
  let mail: Record<string, jest.Mock>;
  let cache: CacheService;
  let service: AuthService;

  const savedUser = { _id: 'u1', name: 'Maria', email: 'maria@x.com', password: '' as string };

  beforeAll(async () => {
    savedUser.password = await bcrypt.hash('senha-correta', 4);
  });

  beforeEach(() => {
    users = {
      findOne: jest.fn(),
      createNewUser: jest.fn(),
      findByEmailWithPassword: jest.fn(),
      setEmailVerifyHash: jest.fn(),
      verifyEmailByHash: jest.fn(),
      startPasswordReset: jest.fn(),
      finishPasswordReset: jest.fn(),
      findById: jest.fn(),
    };
    jwt = { login: jest.fn().mockReturnValue({ accessToken: 'jwt-token' }) };
    mail = { sendVerification: jest.fn(), sendPasswordReset: jest.fn() };
    cache = new CacheService(configStub());
    service = new AuthService(users as any, jwt as any, mail as any, cache);
  });

  describe('register', () => {
    it('stores a hash (never the password), sends the confirmation e-mail and returns a token', async () => {
      users.findOne.mockResolvedValue(null);
      users.createNewUser.mockResolvedValue({ _id: 'u1', name: 'Maria', email: 'maria@x.com' });

      const result = await service.register({ name: ' Maria ', email: ' Maria@X.com ', password: 'senha-12345' });

      const created = users.createNewUser.mock.calls[0][0];
      expect(created.email).toBe('maria@x.com');
      expect(created.name).toBe('Maria');
      expect(created.passwordHash).not.toBe('senha-12345');
      expect(await bcrypt.compare('senha-12345', created.passwordHash)).toBe(true);
      expect(mail.sendVerification).toHaveBeenCalledWith('maria@x.com', 'Maria', expect.stringMatching(/^[a-f0-9]{64}$/));
      expect(users.setEmailVerifyHash).toHaveBeenCalledWith('u1', expect.stringMatching(/^[a-f0-9]{64}$/));
      expect(result.accessToken).toBe('jwt-token');
      expect(result.user).toEqual({ id: 'u1', name: 'Maria', email: 'maria@x.com' });
    });

    it('stores only the hash of the verification token, not the token that was e-mailed', async () => {
      users.findOne.mockResolvedValue(null);
      users.createNewUser.mockResolvedValue({ _id: 'u1', name: 'M', email: 'm@x.com' });

      await service.register({ name: 'M', email: 'm@x.com', password: 'senha-12345' });

      const emailed = mail.sendVerification.mock.calls[0][2];
      const stored = users.setEmailVerifyHash.mock.calls[0][1];
      expect(stored).not.toBe(emailed);
    });

    it('rejects an e-mail that already exists (409)', async () => {
      users.findOne.mockResolvedValue({ _id: 'x' });
      await expect(service.register({ name: 'M', email: 'a@b.com', password: 'senha-12345' })).rejects.toBeInstanceOf(ConflictException);
      expect(users.createNewUser).not.toHaveBeenCalled();
    });

    it('turns the unique-index race (Mongo 11000) into a 409', async () => {
      users.findOne.mockResolvedValue(null);
      users.createNewUser.mockRejectedValue({ code: 11000 });
      await expect(service.register({ name: 'M', email: 'a@b.com', password: 'senha-12345' })).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('returns a token for the right password and normalises the e-mail', async () => {
      users.findByEmailWithPassword.mockResolvedValue(savedUser);
      const result = await service.login({ email: ' MARIA@x.com ', password: 'senha-correta' });
      expect(users.findByEmailWithPassword).toHaveBeenCalledWith('maria@x.com');
      expect(result.accessToken).toBe('jwt-token');
    });

    it('answers the same 401 for a wrong password and for an unknown e-mail', async () => {
      users.findByEmailWithPassword.mockResolvedValueOnce(savedUser).mockResolvedValueOnce(null);
      const wrong = await service.login({ email: 'maria@x.com', password: 'errada' }).catch((e) => e);
      const unknown = await service.login({ email: 'ninguem@x.com', password: 'qualquer' }).catch((e) => e);
      expect(wrong).toBeInstanceOf(UnauthorizedException);
      expect(unknown).toBeInstanceOf(UnauthorizedException);
      expect(wrong.message).toBe(unknown.message);
    });

    it('blocks the account (429) after too many failures, even with the right password', async () => {
      users.findByEmailWithPassword.mockResolvedValue(savedUser);
      for (let i = 0; i < MAX_LOGIN_FAILURES; i++) {
        await expect(service.login({ email: 'maria@x.com', password: 'errada' })).rejects.toBeInstanceOf(UnauthorizedException);
      }
      const blocked = await service.login({ email: 'maria@x.com', password: 'senha-correta' }).catch((e) => e);
      expect(blocked).toBeInstanceOf(HttpException);
      expect(blocked.getStatus()).toBe(429);
    });

    it('a successful login clears the failure counter', async () => {
      users.findByEmailWithPassword.mockResolvedValue(savedUser);
      for (let i = 0; i < MAX_LOGIN_FAILURES - 1; i++) {
        await service.login({ email: 'maria@x.com', password: 'errada' }).catch(() => undefined);
      }
      await service.login({ email: 'maria@x.com', password: 'senha-correta' });
      expect(await cache.count('login-fail:maria@x.com')).toBe(0);
    });

    it('failures of one account do not block another', async () => {
      users.findByEmailWithPassword.mockResolvedValue(savedUser);
      for (let i = 0; i < MAX_LOGIN_FAILURES; i++) {
        await service.login({ email: 'vitima@x.com', password: 'errada' }).catch(() => undefined);
      }
      await expect(service.login({ email: 'maria@x.com', password: 'senha-correta' })).resolves.toBeTruthy();
    });
  });

  describe('forgotPassword', () => {
    it('e-mails a reset link for a known address', async () => {
      users.startPasswordReset.mockResolvedValue({ email: 'maria@x.com', name: 'Maria' });
      await expect(service.forgotPassword(' Maria@x.com ')).resolves.toEqual({ ok: true });
      expect(users.startPasswordReset).toHaveBeenCalledWith('maria@x.com', expect.stringMatching(/^[a-f0-9]{64}$/), 60_000);
      expect(mail.sendPasswordReset).toHaveBeenCalledWith('maria@x.com', 'Maria', expect.any(String));
    });

    it('gives the same answer and sends nothing for an unknown (or throttled) address', async () => {
      users.startPasswordReset.mockResolvedValue(null);
      await expect(service.forgotPassword('ninguem@x.com')).resolves.toEqual({ ok: true });
      expect(mail.sendPasswordReset).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('sets a new bcrypt hash through the token hash', async () => {
      users.finishPasswordReset.mockResolvedValue({ _id: 'u1' });
      await service.resetPassword('a'.repeat(64), 'nova-senha-123');
      const [tokenHash, passwordHash] = users.finishPasswordReset.mock.calls[0];
      expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(tokenHash).not.toBe('a'.repeat(64));
      expect(await bcrypt.compare('nova-senha-123', passwordHash)).toBe(true);
    });

    it('rejects an invalid, used or expired token (400)', async () => {
      users.finishPasswordReset.mockResolvedValue(null);
      await expect(service.resetPassword('x'.repeat(40), 'nova-senha-123')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('verifyEmail / resendVerification', () => {
    it('confirms the e-mail when the token matches', async () => {
      users.verifyEmailByHash.mockResolvedValue({ _id: 'u1' });
      await expect(service.verifyEmail('t'.repeat(40))).resolves.toEqual({ ok: true });
    });

    it('rejects an unknown or already used token (400)', async () => {
      users.verifyEmailByHash.mockResolvedValue(null);
      await expect(service.verifyEmail('t'.repeat(40))).rejects.toBeInstanceOf(BadRequestException);
    });

    it('does not resend to an already verified account', async () => {
      users.findById.mockResolvedValue({ _id: 'u1', emailVerified: true, name: 'M', email: 'm@x.com' });
      await service.resendVerification('u1');
      expect(mail.sendVerification).not.toHaveBeenCalled();
    });

    it('resends to an unverified account and rejects a vanished user', async () => {
      users.findById.mockResolvedValueOnce({ _id: 'u1', emailVerified: false, name: 'M', email: 'm@x.com' }).mockResolvedValueOnce(null);
      await service.resendVerification('u1');
      expect(mail.sendVerification).toHaveBeenCalledTimes(1);
      await expect(service.resendVerification('u1')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('oauthLogin (Google)', () => {
    it('refuses a provider e-mail that is not verified', async () => {
      await expect(service.oauthLogin({ email: 'a@b.com', name: 'A', emailVerified: false })).rejects.toBeInstanceOf(UnauthorizedException);
      expect(users.createNewUser).not.toHaveBeenCalled();
    });

    it('creates the account (verified, no password) on first login', async () => {
      users.findOne.mockResolvedValue(null);
      users.createNewUser.mockResolvedValue({ _id: 'u9', name: 'Ana', email: 'ana@x.com' });
      const res = await service.oauthLogin({ email: ' Ana@X.com ', name: ' Ana ', emailVerified: true });
      expect(users.createNewUser).toHaveBeenCalledWith({ name: 'Ana', email: 'ana@x.com', emailVerified: true });
      expect(res.accessToken).toBe('jwt-token');
    });

    it('signs in an existing account and confirms its e-mail', async () => {
      users.findOne.mockResolvedValue({ _id: 'u1', name: 'M', email: 'm@x.com', emailVerified: false });
      users.markEmailVerified = jest.fn();
      await service.oauthLogin({ email: 'm@x.com', name: 'M', emailVerified: true });
      expect(users.createNewUser).not.toHaveBeenCalled();
      expect(users.markEmailVerified).toHaveBeenCalledWith('u1');
    });
  });
});
