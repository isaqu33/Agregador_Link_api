import { MongooseModule } from '@nestjs/mongoose';
import { Module } from '@nestjs/common';
import { Link, LinkSchema } from './../links/schemas/link.schema';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User, UserSchema } from './schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Link.name, schema: LinkSchema },
    ]),
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
