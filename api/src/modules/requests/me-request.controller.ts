import {
  Body,
  Controller,
  Get,
  PipeTransform,
  Put,
  Query,
} from '@nestjs/common';
import { parseYm } from '../../common/ym';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { MeRequestService } from './me-request.service';
import { SaveMyLinesBody } from './request.dto';

// Vắng ym = kỳ đang mở
class OptionalYmPipe implements PipeTransform<unknown, string | undefined> {
  transform(value: unknown): string | undefined {
    return value === undefined ? undefined : parseYm(value);
  }
}

@Controller('me/request')
export class MeRequestController {
  constructor(private readonly service: MeRequestService) {}

  @Get()
  get(
    @CurrentIdentity() me: RequestIdentity,
    @Query('ym', OptionalYmPipe) ym?: string,
  ) {
    return this.service.get(me, ym);
  }

  @Put('lines')
  saveLines(
    @CurrentIdentity() me: RequestIdentity,
    @Body() body: SaveMyLinesBody,
  ) {
    return this.service.saveLines(me, body);
  }
}
