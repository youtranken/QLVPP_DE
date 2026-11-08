import { Injectable } from '@nestjs/common';
import type { Executor } from '../../database/database.module';
import type { ItemFacts } from '../catalog/catalog-sql';
import { CatalogService } from '../catalog/catalog.service';
import { UsersService } from '../users/users.service';
import { isMemberReadonly } from './request-lines.rules';
import type { LineRow, ReviewStatus } from './request-lines.rules';
import * as repo from './requests.repo';

export interface LineView {
  id: string;
  item_id: string | null;
  item: Omit<ItemFacts, 'id' | 'max_qty'> | null;
  custom_name: string | null;
  custom_unit: string | null;
  custom_note: string | null;
  image_file_id: string | null;
  qty: number;
  delivered_qty: number;
  cancelled_qty: number;
  cancel_note: string | null;
  review_status: ReviewStatus;
  review_note: string | null;
  added_by_admin: boolean;
  readonly_for_member: boolean;
  // Tối đa/tháng hiện tại của món (có thể đã hạ sau khi lưu); null với dòng ngoài DM
  max_qty: number | null;
  last_delivered_at: string | null;
}

export interface RequestView {
  id: string;
  period_ym: string;
  user_sub: string;
  full_name: string | null;
  department: string | null;
  updated_at: string;
  // Giờ nhân viên lưu phiếu lần cuối ("lưu lúc"); updated_at còn đổi theo Hành chính
  saved_at: string;
  is_open: boolean;
  lines: LineView[];
}

@Injectable()
export class RequestViewBuilder {
  constructor(
    private readonly catalog: CatalogService,
    private readonly users: UsersService,
  ) {}

  async build(
    ex: Executor,
    requestId: string,
    isOpen: boolean,
  ): Promise<RequestView | null> {
    const head = await repo.findRequest(ex, { id: requestId });
    if (!head) return null;
    const lines = await repo.listLines(ex, requestId);
    const ids = lines.map((l) => l.item_id).filter((id): id is string => !!id);
    const items = await this.catalog.itemFacts([...new Set(ids)], ex);
    const owner = await this.users.findBySub(head.user_sub);
    return {
      id: head.id,
      period_ym: head.period_ym,
      user_sub: head.user_sub,
      full_name: owner?.fullName ?? null,
      department: head.department,
      updated_at: head.updated_at,
      saved_at: head.saved_at,
      is_open: isOpen,
      lines: lines.map((l) => toLineView(l, items)),
    };
  }
}

export function toLineView(
  line: LineRow,
  items: Map<string, ItemFacts>,
): LineView {
  const item = line.item_id ? items.get(line.item_id) : undefined;
  return {
    id: line.id,
    item_id: line.item_id,
    item: item
      ? {
          name: item.name,
          name_en: item.name_en,
          unit: item.unit,
          pack_note: item.pack_note,
          image_file_id: item.image_file_id,
          active: item.active,
          admin_only: item.admin_only,
        }
      : null,
    custom_name: line.custom_name,
    custom_unit: line.custom_unit,
    custom_note: line.custom_note,
    image_file_id: line.image_file_id,
    qty: line.qty,
    delivered_qty: line.delivered_qty,
    cancelled_qty: line.cancelled_qty,
    cancel_note: line.cancel_note,
    review_status: line.review_status,
    review_note: line.review_note,
    added_by_admin: line.added_by_admin,
    readonly_for_member: isMemberReadonly(line),
    max_qty: item?.max_qty ?? null,
    last_delivered_at: line.last_delivered_at ?? null,
  };
}
