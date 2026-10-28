import { Controller, Get, Query } from '@nestjs/common';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { ListItemsQuery } from './catalog.dto';
import { CatalogService } from './catalog.service';

@Controller('items')
export class ItemsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(
    @Query() query: ListItemsQuery,
    @CurrentIdentity() identity: RequestIdentity,
  ) {
    return this.catalog.listFor(identity, query.include_inactive_ids);
  }
}
