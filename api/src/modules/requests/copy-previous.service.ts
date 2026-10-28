import { Inject, Injectable } from '@nestjs/common';
import { ClockService } from '../../common/clock.service';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import type { RequestIdentity } from '../auth/identity.types';
import { CatalogService } from '../catalog/catalog.service';
import { SystemConfigService } from '../config/system-config.service';
import { PeriodsService } from '../periods/periods.service';
import { requestNotFound } from './request-errors';
import type { LineRow } from './request-lines.rules';
import * as repo from './requests.repo';

export type SourceLine = Omit<
  LineRow,
  'id' | 'delivered_qty' | 'cancelled_qty' | 'review_note'
>;
export interface CopyItemFacts {
  name: string;
  active: boolean;
  admin_only: boolean;
  max_qty: number;
}
export type SkipReason =
  'INACTIVE' | 'ADMIN_ONLY' | 'ADDED_BY_ADMIN' | 'REJECTED';
export type CopiedLine =
  | { item_id: string; qty: number }
  | {
      custom_name: string | null;
      custom_unit: string | null;
      custom_note: string | null;
      image_file_id: string | null;
      qty: number;
    };
export interface CopyResult {
  lines: CopiedLine[];
  skipped: { name: string; reason: SkipReason }[];
  capped: { name: string; from: number; to: number }[];
  previously_accepted: string[];
}

type Kept =
  { item_id: string; item: CopyItemFacts; qty: number } | { line: SourceLine };

// Thuần: giỏ đề xuất từ dòng phiếu cũ theo danh mục hiện tại (architecture §6 Copy-previous)
export function buildCopy(
  lines: SourceLine[],
  items: Map<string, CopyItemFacts>,
  defaultMax: number,
): CopyResult {
  const out: CopyResult = {
    lines: [],
    skipped: [],
    capped: [],
    previously_accepted: [],
  };
  out.lines = keepLines(lines, items, out).map((k) =>
    'item_id' in k
      ? {
          item_id: k.item_id,
          qty: cap(out, k.item.name, k.qty, k.item.max_qty),
        }
      : {
          custom_name: k.line.custom_name,
          custom_unit: k.line.custom_unit,
          custom_note: k.line.custom_note,
          image_file_id: k.line.image_file_id,
          qty: cap(out, k.line.custom_name ?? '', k.line.qty, defaultMax),
        },
  );
  return out;
}

// Giữ thứ tự dòng gốc; n/a và converted cùng món được phép trong phiếu cũ nhưng lưu lại sẽ DUPLICATE_ITEM → gộp
function keepLines(
  lines: SourceLine[],
  items: Map<string, CopyItemFacts>,
  out: CopyResult,
): Kept[] {
  const kept: Kept[] = [];
  const byItem = new Map<string, { qty: number }>();
  for (const line of lines) {
    const item = line.item_id ? items.get(line.item_id) : undefined;
    const name = (line.item_id ? item?.name : line.custom_name) ?? '';
    const reason = skipReason(line, item);
    if (reason) {
      out.skipped.push({ name, reason });
    } else if (line.item_id && item) {
      const prev = byItem.get(line.item_id);
      if (prev) prev.qty += line.qty;
      else {
        const entry = { item_id: line.item_id, item, qty: line.qty };
        byItem.set(line.item_id, entry);
        kept.push(entry);
      }
    } else {
      if (line.review_status === 'accepted') out.previously_accepted.push(name);
      kept.push({ line });
    }
  }
  return kept;
}

function skipReason(
  line: SourceLine,
  item: CopyItemFacts | undefined,
): SkipReason | null {
  if (line.added_by_admin) return 'ADDED_BY_ADMIN';
  if (line.review_status === 'rejected') return 'REJECTED';
  if (!line.item_id) return null;
  // Món không còn trong bảng (không thể khi đã có dòng dùng, nhưng phòng hờ) coi như ngừng
  if (!item || !item.active) return 'INACTIVE';
  if (item.admin_only) return 'ADMIN_ONLY';
  return null;
}

function cap(out: CopyResult, name: string, qty: number, max: number): number {
  if (qty <= max) return qty;
  out.capped.push({ name, from: qty, to: max });
  return max;
}

@Injectable()
export class CopyPreviousService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly clock: ClockService,
    private readonly periods: PeriodsService,
    private readonly catalog: CatalogService,
    private readonly config: SystemConfigService,
  ) {}

  // Chỉ đọc: giỏ đề xuất để client hiển thị, member tự bấm Lưu
  async copy(me: RequestIdentity): Promise<CopyResult & { from_ym: string }> {
    const open = await this.periods.openPeriod(this.db, this.clock.now());
    const source = await repo.findLatestBefore(this.db, me.sub, open.ym);
    if (!source) throw requestNotFound('Chưa có phiếu kỳ trước để chép.');
    const lines = await repo.listLines(this.db, source.id);
    const ids = lines.map((l) => l.item_id).filter((id): id is string => !!id);
    const items = await this.catalog.itemFacts([...new Set(ids)], this.db);
    const defaultMax = await this.config.getInt('default_max_qty');
    return {
      from_ym: source.period_ym,
      ...buildCopy(lines, items, defaultMax),
    };
  }
}
