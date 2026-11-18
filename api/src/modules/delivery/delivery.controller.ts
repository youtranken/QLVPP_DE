import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { Roles } from '../auth/roles.decorator';
import { uuidParam } from '../catalog/catalog.dto';
import { BulkDeliveryService } from './bulk-delivery.service';
import { BulkDeliverBody } from './bulk-delivery.dto';
import { UndoBody } from '../undo/undo.dto';
import { CancelRemainingService } from './cancel-remaining.service';
import { CancelUndoService } from './cancel-undo.service';
import { CancelBody, DeliverBody } from './delivery.dto';
import { DeliveryService } from './delivery.service';
import { DeliveryUndoService } from './delivery-undo.service';

@Controller('admin')
@Roles('admin', 'sa')
export class DeliveryController {
  constructor(
    private readonly service: DeliveryService,
    private readonly cancelService: CancelRemainingService,
    private readonly bulk: BulkDeliveryService,
    private readonly deliveryUndo: DeliveryUndoService,
    private readonly cancelUndo: CancelUndoService,
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

  @Post('deliveries/bulk')
  @HttpCode(200)
  deliverBulk(
    @CurrentIdentity() admin: RequestIdentity,
    @Body() body: BulkDeliverBody,
  ) {
    return this.bulk.deliver(body, admin.sub);
  }

  @Post('lines/:id/cancel-remaining')
  @HttpCode(200)
  cancelRemaining(
    @CurrentIdentity() admin: RequestIdentity,
    @Param('id', uuidParam) id: string,
    @Body() body: CancelBody,
  ) {
    return this.cancelService.cancelRemaining(id, body, admin.sub);
  }

  @Post('undo/delivery')
  @HttpCode(200)
  undoDelivery(
    @CurrentIdentity() admin: RequestIdentity,
    @Body() body: UndoBody,
  ) {
    return this.deliveryUndo.undoDeliveries(body.ids, admin.sub);
  }

  @Post('undo/cancel')
  @HttpCode(200)
  undoCancel(
    @CurrentIdentity() admin: RequestIdentity,
    @Body() body: UndoBody,
  ) {
    return this.cancelUndo.undoCancels(body.ids, admin.sub);
  }
}
