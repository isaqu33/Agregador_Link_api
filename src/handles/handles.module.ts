import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Page, PageSchema } from '../pages/schemas/page.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { Handle, HandleSchema } from './handle.schema';
import { HandlesService } from './handles.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Handle.name, schema: HandleSchema },
      { name: User.name, schema: UserSchema },
      { name: Page.name, schema: PageSchema },
    ]),
  ],
  providers: [HandlesService],
  exports: [HandlesService],
})
export class HandlesModule {}
