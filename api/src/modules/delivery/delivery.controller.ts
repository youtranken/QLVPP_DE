import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { Roles } from '../auth/roles.decorator';
import { uuidParam } from '../catalog/catalog.dto';
import { DeliverAllService } from './deliver-all.service';
import { DeliverBody } from './delivery.dto';
import { DeliveryService } from './delivery.service';

@Controller('admin')
@Roles('admin', 'sa')
export class DeliveryController {
  constructor(
    private readonly service: DeliveryService,
    private readonly deliverAllService: DeliverAllService,
  ) {}

  // Cập nhật dòng có sẵn → 200 thay vì 201 mặc định của POST
  @Post('lines/:id/deliver')
  @HttpCode(200)
  deliver(
    @CurrentIdentity() admin: RequestIdentity,
    @Param('id', uuidParam) id: string,
    @Body() body: DeliverBody,
  ) {
    return this.service.deliverLine(id, body, admin.sub);
  }

  @Post('requests/:id/deliver-all')
  @HttpCode(200)
  deliverAll(
    @CurrentIdentity() admin: RequestIdentity,
    @Param('id', uuidParam) id: string,
  ) {
    return this.deliverAllService.deliverAll(id, admin.sub);
  }
}
