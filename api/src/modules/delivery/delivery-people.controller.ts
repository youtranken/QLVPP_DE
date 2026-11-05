import { Controller, Get, Param } from '@nestjs/common';
import { YmPipe } from '../../common/ym';
import { Roles } from '../auth/roles.decorator';
import { DeliveryPeopleService } from './delivery-people.service';

@Controller('admin/periods')
@Roles('admin', 'sa')
export class DeliveryPeopleController {
  constructor(private readonly service: DeliveryPeopleService) {}

  @Get(':ym/delivery-people')
  list(@Param('ym', YmPipe) ym: string) {
    return this.service.list(ym);
  }
}
