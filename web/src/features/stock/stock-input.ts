export const REASON_MAX = 500;

export const toInt = (text: string) => (/^[-+]?\d+$/.test(text.trim()) ? Number(text) : null);
