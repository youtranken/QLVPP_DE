export type DiffTone = 'ok' | 'short' | 'surplus';

// Đủ khi 0, thiếu khi âm, dư khi dương
export const diffTone = (d: number): DiffTone => (d === 0 ? 'ok' : d < 0 ? 'short' : 'surplus');
