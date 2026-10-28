import { Injectable } from '@nestjs/common';
import type { Executor } from '../../database/database.module';
import type { ItemUsageHook } from '../catalog/item-usage.hook';
import { hasItemLines } from './requests.repo';

@Injectable()
export class RequestItemUsageHook implements ItemUsageHook {
  isUsed(itemId: string, tx: Executor): Promise<boolean> {
    return hasItemLines(tx, itemId);
  }
}
