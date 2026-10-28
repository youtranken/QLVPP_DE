import {
  Body,
  Controller,
  Get,
  HttpCode,
  PipeTransform,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { parseYm } from '../../common/ym';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { PageQuery } from '../../common/page.query';
import { CopyPreviousService } from './copy-previous.service';
import { HistoryService } from './history.service';
import { MeRequestService } from './me-request.service';
import { SaveMyLinesBody } from './request.dto';

// Vắng ym = kỳ đang mở
class OptionalYmPipe implements PipeTransform<unknown, string | undefined> {
  transform(value: unknown): string | undefined {
    return value === undefined ? undefined : parseYm(value);
  }
}

@Controller('me')
export class MeRequestController {
  constructor(
    private readonly service: MeRequestService,
    private readonly copyPrevious: CopyPreviousService,
    private readonly history: HistoryService,
  ) {}

  @Get('request')
  get(
    @CurrentIdentity() me: RequestIdentity,
    @Query('ym', OptionalYmPipe) ym?: string,
  ) {
    return this.service.get(me, ym);
  }

  @Put('request/lines')
  saveLines(
    @CurrentIdentity() me: RequestIdentity,
    @Body() body: SaveMyLinesBody,
  ) {
    return this.service.saveLines(me, { ...body, ym: parseYm(body.ym) });
  }

  // Không ghi DB → 200 thay vì 201 mặc định của POST
  @Post('request/copy-previous')
  @HttpCode(200)
  copy(@CurrentIdentity() me: RequestIdentity) {
    return this.copyPrevious.copy(me);
  }

  @Get('requests')
  list(@CurrentIdentity() me: RequestIdentity, @Query() page: PageQuery) {
    return this.history.list(me.sub, page.limit, page.cursor);
  }
}
