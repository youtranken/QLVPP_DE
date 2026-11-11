export const REASON_MAX = 500;

export const toInt = (text: string) => (/^[-+]?\d+$/.test(text.trim()) ? Number(text) : null);

// Dấu trừ thật (U+2212) để số âm không bị đọc như gạch nối
export const signed = (n: number) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);
