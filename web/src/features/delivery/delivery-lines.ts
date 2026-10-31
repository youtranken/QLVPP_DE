import type { LineView } from '@/features/request/request.api';
import { deliverMax, isDeliverable, remainingOf } from './delivery.api';

export interface LineError {
  text: string;
  cap?: number;
  version: number;
}

export interface LineModel {
  line: LineView;
  id: string;
  name: string;
  unit: string;
  remaining: number;
  stock: number | null;
  deliverable: boolean;
  max: number;
  qty: number;
  qtyKey: string;
  short: boolean;
  error?: string;
}

interface Inputs {
  lines: LineView[];
  stockById: ReadonlyMap<string, number>;
  errors: Readonly<Record<string, LineError>>;
  qtys: Readonly<Record<string, { key: string; value: number }>>;
  version: number;
  nameOf: (l: LineView) => string;
  unitOf: (l: LineView) => string;
}

// Lỗi/mức trần STOCK_INSUFFICIENT chỉ đúng với bản phiếu lúc nhận lỗi; số đã chỉnh đặt lại khi max đổi
export function buildLines({ lines, stockById, errors, qtys, version, nameOf, unitOf }: Inputs): LineModel[] {
  return lines.map((l) => {
    const remaining = remainingOf(l);
    const stock = l.item_id ? (stockById.get(l.item_id) ?? null) : null;
    const deliverable = isDeliverable(l) && remaining > 0;
    const err = errors[l.id]?.version === version ? errors[l.id] : undefined;
    const max = deliverable ? deliverMax(remaining, stock, err?.cap) : 0;
    const qtyKey = `${l.delivered_qty}:${remaining}:${max}`;
    const own = qtys[l.id];
    return {
      line: l,
      id: l.id,
      name: nameOf(l),
      unit: unitOf(l),
      remaining,
      stock,
      deliverable,
      max,
      qty: own?.key === qtyKey ? own.value : max,
      qtyKey,
      short: deliverable && stock !== null && remaining > stock,
      error: err?.text,
    };
  });
}

export const isSelectable = (m: LineModel) => m.deliverable && m.max >= 1;
