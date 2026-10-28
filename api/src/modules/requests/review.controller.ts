import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { Roles } from '../auth/roles.decorator';
import { uuidParam } from '../catalog/catalog.dto';
import { ReviewBody, ReviewListQuery } from './review.dto';
import { ReviewService } from './review.service';

@Controller('admin')
@Roles('admin', 'sa')
export class ReviewController {
  constructor(private readonly service: ReviewService) {}

  @Get('review')
  list(@Query() query: ReviewListQuery) {
    return this.service.list(query);
  }

  // Sửa trạng thái dòng có sẵn → 200 thay vì 201 mặc định của POST
  @Post('lines/:id/review')
  @HttpCode(200)
  review(
    @CurrentIdentity() admin: RequestIdentity,
    @Param('id', uuidParam) id: string,
    @Body() body: ReviewBody,
  ) {
    return this.service.review(admin, id, body);
  }
}
