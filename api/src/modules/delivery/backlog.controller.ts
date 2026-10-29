import { Controller, Get, Param, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { uuidParam } from '../catalog/catalog.dto';
import { BacklogService } from './backlog.service';
import { BacklogQuery } from './delivery.dto';

@Controller('admin')
@Roles('admin', 'sa')
export class BacklogController {
  constructor(private readonly service: BacklogService) {}

  @Get('backlog')
  backlog(@Query() query: BacklogQuery) {
    return this.service.backlog(query.by);
  }

  @Get('lines/:id/deliveries')
  deliveries(@Param('id', uuidParam) id: string) {
    return this.service.deliveries(id);
  }
}
