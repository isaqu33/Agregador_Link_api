import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import helmet from 'helmet';
import * as request from 'supertest';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { AppThrottlerGuard } from './common/app-throttler.guard';

// The real controller, guard and pipe, with the service replaced: checks the HTTP layer only.
describe('HTTP security (rate limit, helmet, validation)', () => {
  let app: INestApplication;
  const auth = {
    login: jest.fn().mockResolvedValue({ accessToken: 't' }),
    register: jest.fn().mockResolvedValue({ accessToken: 't' }),
    forgotPassword: jest.fn().mockResolvedValue({ ok: true }),
    resetPassword: jest.fn().mockResolvedValue({ ok: true }),
    verifyEmail: jest.fn().mockResolvedValue({ ok: true }),
  };

  beforeEach(async () => {
    Object.values(auth).forEach((f) => f.mockClear());
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot({ ttl: 60, limit: 120 })],
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: auth }, { provide: APP_GUARD, useClass: AppThrottlerGuard }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });
  afterEach(() => app.close());

  const login = (ip: string) =>
    request(app.getHttpServer()).post('/auth/login').set('x-forwarded-for', ip).send({ email: 'a@b.com', password: 'x' });

  it('sets the helmet security headers', async () => {
    const res = await login('1.1.1.1');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('limits login to 10 per minute per IP, then answers 429 with Retry-After', async () => {
    for (let i = 0; i < 10; i++) expect((await login('1.1.1.1')).status).toBe(200);
    const blocked = await login('1.1.1.1');
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(auth.login).toHaveBeenCalledTimes(10); // the blocked request never reached the service
  });

  it('counts each visitor IP separately', async () => {
    for (let i = 0; i < 10; i++) await login('1.1.1.1');
    expect((await login('1.1.1.1')).status).toBe(429);
    expect((await login('2.2.2.2')).status).toBe(200);
  });

  it('uses only the first address of x-forwarded-for (the visitor)', async () => {
    for (let i = 0; i < 10; i++) await login('3.3.3.3, 10.0.0.1');
    expect((await login('3.3.3.3, 10.0.0.2')).status).toBe(429);
  });

  it.each([
    ['/auth/register', { name: 'M', email: 'a@b.com', password: 'senha-12345' }, 5],
    ['/auth/forgot-password', { email: 'a@b.com' }, 3],
    ['/auth/reset-password', { token: 'x'.repeat(40), password: 'senha-12345' }, 5],
  ])('limits %s to %i per minute', async (path, body, limit) => {
    const hit = () => request(app.getHttpServer()).post(path).set('x-forwarded-for', '9.9.9.9').send(body as object);
    for (let i = 0; i < (limit as number); i++) expect((await hit()).status).toBe(path === '/auth/register' ? 201 : 200);
    expect((await hit()).status).toBe(429);
  });

  it('limits are per route: exhausting login does not block forgot-password', async () => {
    for (let i = 0; i < 11; i++) await login('4.4.4.4');
    const res = await request(app.getHttpServer()).post('/auth/forgot-password').set('x-forwarded-for', '4.4.4.4').send({ email: 'a@b.com' });
    expect(res.status).toBe(200);
  });

  it('validation rejects bad bodies before the service runs (400)', async () => {
    const http = request(app.getHttpServer());
    expect((await http.post('/auth/login').set('x-forwarded-for', '5.5.5.5').send({ email: 'not-an-email', password: 'x' })).status).toBe(400);
    expect((await http.post('/auth/register').set('x-forwarded-for', '5.5.5.5').send({ name: 'M', email: 'a@b.com', password: 'curta' })).status).toBe(400);
    expect((await http.post('/auth/login').set('x-forwarded-for', '5.5.5.5').send({ email: 'a@b.com', password: 'x', admin: true })).status).toBe(400); // extra field
    expect(auth.login).not.toHaveBeenCalled();
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('refuses to reset a password shorter than 8 characters', async () => {
    const res = await request(app.getHttpServer()).post('/auth/reset-password').set('x-forwarded-for', '6.6.6.6').send({ token: 'x'.repeat(40), password: '123' });
    expect(res.status).toBe(400);
    expect(auth.resetPassword).not.toHaveBeenCalled();
  });
});
