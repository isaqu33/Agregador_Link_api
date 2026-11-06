import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { MailService } from './../mail/mail.service';
import { CacheService } from './../cache/cache.service';
import { UserService } from './../user/user.service';
import { JwtAuthService } from './../jwt/jwt.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

// Compared against when the email is unknown, so a miss costs the same as a wrong password.
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 12);

export const MAX_LOGIN_FAILURES = 5;
export const LOGIN_FAIL_WINDOW_SECONDS = 15 * 60;

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtAuthService: JwtAuthService,
    private mail: MailService,
    private cache: CacheService,
  ) {}

  async register({ name, email, password }: RegisterDto) {
    const normalizedEmail = email.trim().toLowerCase();
    if (await this.userService.findOne(normalizedEmail)) {
      throw new ConflictException('Email já cadastrado');
    }

    try {
      const user = await this.userService.createNewUser({
        name: name.trim(),
        email: normalizedEmail,
        passwordHash: await bcrypt.hash(password, 12),
      });

      await this.sendVerification(user);

      return this.issueToken(user);
    } catch (error) {
      // two simultaneous sign-ups for the same email: the unique index wins
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('Email já cadastrado');
      }
      throw error;
    }
  }

  async login({ email, password }: LoginDto) {
    const normalizedEmail = email.trim().toLowerCase();

    // per-account brake against password guessing (the per-IP limit alone is not enough
    // when the attacker rotates addresses): too many recent failures -> wait
    const failKey = `login-fail:${normalizedEmail}`;
    if ((await this.cache.count(failKey)) >= MAX_LOGIN_FAILURES) {
      throw new HttpException(
        'Muitas tentativas. Tente novamente em alguns minutos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.userService.findByEmailWithPassword(
      normalizedEmail,
    );
    const valid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);

    if (!user || !user.password || !valid) {
      await this.cache.incr(failKey, LOGIN_FAIL_WINDOW_SECONDS);
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    await this.cache.reset(failKey);
    return this.issueToken(user);
  }

  // Called by the front server once Google confirmed who the person is. The provider e-mail
  // must be verified, otherwise anyone could claim an address they do not own.
  async oauthLogin({
    email,
    name,
    emailVerified,
  }: {
    email: string;
    name: string;
    emailVerified: boolean;
  }) {
    if (!emailVerified) {
      throw new UnauthorizedException('E-mail do provedor não verificado');
    }
    const normalizedEmail = email.trim().toLowerCase();

    let user = await this.userService.findOne(normalizedEmail);
    if (!user) {
      user = await this.userService.createNewUser({
        name: name.trim(),
        email: normalizedEmail,
        emailVerified: true,
      });
    } else if (!user.emailVerified) {
      await this.userService.markEmailVerified(String(user._id));
    }
    return this.issueToken(user);
  }

  private issueToken(user: { _id: unknown; email: string; name: string }) {
    const id = String(user._id);
    const { accessToken } = this.jwtAuthService.login({
      id,
      username: user.email,
    });
    return {
      accessToken,
      user: { id, name: user.name, email: user.email },
    };
  }

  // --- email verification and password recovery ---

  async sendVerification(user: { _id: unknown; name: string; email: string }) {
    const token = randomBytes(32).toString('hex');
    await this.userService.setEmailVerifyHash(
      String(user._id),
      hashToken(token),
    );
    await this.mail.sendVerification(user.email, user.name, token);
  }

  async resendVerification(userId: string) {
    const user = await this.userService.findById(userId);
    if (!user) throw new UnauthorizedException();
    if (!user.emailVerified) await this.sendVerification(user);
    return { ok: true };
  }

  async verifyEmail(token: string) {
    const user = await this.userService.verifyEmailByHash(hashToken(token));
    if (!user) throw new BadRequestException('Link inválido ou já utilizado');
    return { ok: true };
  }

  // Always answers the same, so the endpoint can't be used to discover which emails exist.
  async forgotPassword(email: string) {
    const token = randomBytes(32).toString('hex');
    const user = await this.userService.startPasswordReset(
      email.trim().toLowerCase(),
      hashToken(token),
      60 * 1000,
    );
    if (user) await this.mail.sendPasswordReset(user.email, user.name, token);
    return { ok: true };
  }

  async resetPassword(token: string, password: string) {
    const user = await this.userService.finishPasswordReset(
      hashToken(token),
      await bcrypt.hash(password, 12),
    );
    if (!user) throw new BadRequestException('Link inválido ou expirado');
    return { ok: true };
  }
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
