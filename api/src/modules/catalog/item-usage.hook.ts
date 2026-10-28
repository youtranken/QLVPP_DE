import { Injectable } from '@nestjs/common';

export const ITEM_USAGE_HOOK = Symbol('ITEM_USAGE_HOOK');

export interface ItemUsageHook {
  isUsed(itemId: string): Promise<boolean>;
}

// Chưa có request_lines ở Plan 1; Plan 2 thay provider bằng bản kiểm request_lines
@Injectable()
export class NoItemUsageHook implements ItemUsageHook {
  isUsed(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
