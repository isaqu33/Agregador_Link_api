import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Event, EventSchema } from '../analytics/schemas/event.schema';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { Link, LinkSchema } from '../links/schemas/link.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';
import { Page, PageSchema } from './schemas/page.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Page.name, schema: PageSchema },
      { name: User.name, schema: UserSchema },
      { name: Link.name, schema: LinkSchema },
      { name: Lead.name, schema: LeadSchema },
      { name: Event.name, schema: EventSchema },
    ]),
  ],
  controllers: [PagesController],
  providers: [PagesService],
})
export class PagesModule {}
