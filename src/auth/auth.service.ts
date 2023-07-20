import { UserService } from './../user/user.service';
import { Injectable } from '@nestjs/common';


@Injectable()
export class AuthService {
  constructor(private userService: UserService) { }

  async validateUser(email: string): Promise<any> {
    const user = await this.userService.findOne(email);
    if (user) {

      const { email, id, name } = user

      return { email, id, name }
    }
    return null;
  }
}
