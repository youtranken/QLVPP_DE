import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ClockService } from '../../common/clock.service';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { MarkReadBody, NotificationsQuery } from './notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller('me/notifications')
export class MeNotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly clock: ClockService,
  ) {}

  @Get()
  list(
    @Query() q: NotificationsQuery,
    @CurrentIdentity() identity: RequestIdentity,
  ) {
    return this.notifications.list(identity.sub, {
      unread: q.unread === undefined ? undefined : q.unread === 'true',
      limit: q.limit,
      cursor: q.cursor,
    });
  }

  @Post('read')
  @HttpCode(200)
  read(
    @Body() body: MarkReadBody,
    @CurrentIdentity() identity: RequestIdentity,
  ) {
    return this.notifications.markRead(
      identity.sub,
      body.ids,
      this.clock.now(),
    );
  }
}
