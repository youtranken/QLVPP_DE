import { Body, Controller, Param, Post, Put } from '@nestjs/common';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { Roles } from '../auth/roles.decorator';
import { uuidParam } from '../catalog/catalog.dto';
import { AdminRequestService } from './admin-request.service';
import { CreateOnBehalfBody, SaveLinesBody } from './request.dto';

@Controller('admin/requests')
@Roles('admin', 'sa')
export class AdminRequestsController {
  constructor(private readonly service: AdminRequestService) {}

  @Put(':id/lines')
  saveLines(
    @CurrentIdentity() admin: RequestIdentity,
    @Param('id', uuidParam) id: string,
    @Body() body: SaveLinesBody,
  ) {
    return this.service.saveLines(admin, id, body);
  }

  @Post()
  create(
    @CurrentIdentity() admin: RequestIdentity,
    @Body() body: CreateOnBehalfBody,
  ) {
    return this.service.create(admin, body);
  }
}
