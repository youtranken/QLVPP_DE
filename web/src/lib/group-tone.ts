export type Tone = 'g0' | 'g1' | 'g2' | 'g3' | 'g4' | 'g5' | 'g6' | 'g7';

const TONES: Tone[] = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7'];

export const TONE_COUNT = TONES.length;

export const toneAtRank = (rank: number): Tone => TONES[rank % TONES.length];

export function groupTone(categories: { id: string; sort_order: number }[], categoryId: string | null): Tone {
  if (categoryId == null) return 'g0';
  const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const rank = sorted.findIndex((c) => c.id === categoryId);
  return rank < 0 ? 'g0' : toneAtRank(rank);
}
