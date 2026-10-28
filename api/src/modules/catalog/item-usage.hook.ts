import { Injectable } from '@nestjs/common';
import type { Executor } from '../../database/database.module';

export const ITEM_USAGE_HOOK = Symbol('ITEM_USAGE_HOOK');

export interface ItemUsageHook {
  isUsed(itemId: string, tx: Executor): Promise<boolean>;
}

// Module sở hữu bảng trỏ tới items (requests) tự đăng ký vào đây: catalog không import ngược module đó
@Injectable()
export class ItemUsageRegistry implements ItemUsageHook {
  private readonly checks: ItemUsageHook[] = [];

  register(check: ItemUsageHook): void {
    this.checks.push(check);
  }

  async isUsed(itemId: string, tx: Executor): Promise<boolean> {
    for (const check of this.checks) {
      if (await check.isUsed(itemId, tx)) return true;
    }
    return false;
  }
}
