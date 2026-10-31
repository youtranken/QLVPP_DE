import type { Unit } from '@/features/units/units.api';

const SEED: [string, string, string][] = [
  ['cai', 'cái', 'piece'],
  ['hop', 'hộp', 'box'],
  ['cay', 'cây', 'stick'],
  ['ram', 'ram', 'ream'],
  ['cuon', 'cuộn', 'roll'],
  ['loc', 'lốc', 'pack'],
  ['bich', 'bịch', 'bag'],
  ['chai', 'chai', 'bottle'],
  ['bo', 'bộ', 'set'],
];

// Cùng 9 ĐVT seed của migration 0111
export const SEED_UNITS: Unit[] = SEED.map(([code, name, name_en], i) => ({
  code,
  name,
  name_en,
  sort_order: (i + 1) * 10,
  active: true,
}));
