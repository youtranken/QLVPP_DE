export type Tone = 'g0' | 'g1' | 'g2' | 'g3' | 'g4' | 'g5' | 'g6' | 'g7';

const TONES: Tone[] = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7'];

export const TONE_COUNT = TONES.length;

export const toneAtRank = (rank: number): Tone => TONES[rank % TONES.length];

type Ranked = { id: string; name: string; sort_order: number };

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// Cùng thứ tự server (ORDER BY sort_order, lower(name)), id để không bao giờ hòa
export function compareCategories(a: Ranked, b: Ranked): number {
  return a.sort_order - b.sort_order || byText(a.name.toLowerCase(), b.name.toLowerCase()) || byText(a.id, b.id);
}

export function groupTone(categories: Ranked[], categoryId: string | null): Tone {
  if (categoryId == null) return 'g0';
  const sorted = [...categories].sort(compareCategories);
  const rank = sorted.findIndex((c) => c.id === categoryId);
  return rank < 0 ? 'g0' : toneAtRank(rank);
}
