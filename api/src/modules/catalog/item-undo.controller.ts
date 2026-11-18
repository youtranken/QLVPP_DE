import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { Roles } from '../auth/roles.decorator';
import { UndoBody } from '../undo/undo.dto';
import { ItemUndoService } from './item-undo.service';

@Controller('admin/undo')
@Roles('admin', 'sa')
export class ItemUndoController {
  constructor(private readonly service: ItemUndoService) {}

  @Post('item-delete')
  @HttpCode(200)
  undoDelete(
    @CurrentIdentity() identity: RequestIdentity,
    @Body() body: UndoBody,
  ) {
    return this.service.undoDeletes(body.ids, identity.sub);
  }
}
