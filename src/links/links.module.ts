import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LinksService } from './links.service';
import { LinksController } from './links.controller';
import { Link, LinkSchema } from './schemas/link.schema';
import { User, UserSchema } from './../user/schemas/user.schema';
import { Page, PageSchema } from './../pages/schemas/page.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Link.name, schema: LinkSchema },
      { name: User.name, schema: UserSchema },
      { name: Page.name, schema: PageSchema },
    ]),
  ],
  controllers: [LinksController],
  providers: [LinksService],
  exports: [LinksService],
})
export class LinksModule {}
