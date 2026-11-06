import type { ArrivalsPlan, PlanCustomRow, PlanRow } from './arrivals.api';

export const planRow = (over: Partial<PlanRow> = {}): PlanRow => ({
  item_id: 'i-a',
  key: over.item_id ?? 'i-a',
  code: 'A1',
  name: 'Bút bi',
  name_en: 'Ballpoint pen',
  unit: 'cay',
  category_id: 'c-but',
  image_file_id: null,
  ordered: 10,
  received: 0,
  remaining: 10,
  stock_qty: 0,
  usable: true,
  inactive_reason: null,
  adm_out: false,
  adm_out_final: false,
  reduced_after_snapshot: 0,
  ...over,
});

export const customRow = (over: Partial<PlanCustomRow> = {}): PlanCustomRow => ({
  key: 'custom:["kéo cắt giấy", "cái"]',
  name: 'Kéo cắt giấy',
  unit: 'cai',
  ordered: 2,
  received: 0,
  remaining: 2,
  adm_out: false,
  adm_out_final: false,
  ...over,
});

export const SNAP = { id: 's-1', kind: 'print', created_at: '2026-11-02T02:05:00.000Z' };

export const plan = (rows: PlanRow[], over: Partial<ArrivalsPlan> = {}): ArrivalsPlan => ({
  snapshot: SNAP,
  batches: [],
  rows,
  custom: [],
  makeup: [],
  ...over,
});
