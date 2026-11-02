import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UserService } from './../user/user.service';
import { JwtAuthService } from './../jwt/jwt.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

// Compared against when the email is unknown, so a miss costs the same as a wrong password.
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 12);

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtAuthService: JwtAuthService,
  ) {}

  async register({ name, email, password }: RegisterDto) {
    const normalizedEmail = email.trim().toLowerCase();
    if (await this.userService.findOne(normalizedEmail)) {
      throw new ConflictException('Email já cadastrado');
    }

    const user = await this.userService.createNewUser({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 12),
    });

    return this.issueToken(user);
  }

  async login({ email, password }: LoginDto) {
    const user = await this.userService.findOne(email.trim().toLowerCase());
    const valid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);

    if (!user || !user.password || !valid) {
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    return this.issueToken(user);
  }

  private issueToken(user: { id: string; email: string; name: string }) {
    const { accessToken } = this.jwtAuthService.login({
      id: user.id,
      username: user.email,
    });
    return {
      accessToken,
      user: { id: user.id, name: user.name, email: user.email },
    };
  }
}
