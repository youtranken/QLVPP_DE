export const REASON_MAX = 500;

export const toInt = (text: string) => (/^[-+]?\d+$/.test(text.trim()) ? Number(text) : null);

// Dấu trừ thật (U+2212) để số âm không bị đọc như gạch nối
export const signed = (n: number) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);

// Trùng QTY_MAX của StockChangeDto / IssueDto ở api (stock.dto.ts); server vẫn kiểm lại
export const STOCK_QTY_MAX = 1_000_000;

export type QtyErrorCode = 'empty' | 'decimal' | 'min' | 'max' | 'overStock';
export interface QtyError {
  code: QtyErrorCode;
  max: number;
}

function qtyError(text: string, max: number, overCode: 'max' | 'overStock'): QtyError | null {
  const s = text.trim();
  if (s === '') return { code: 'empty', max };
  if (/^\d+[.,]\d+$/.test(s)) return { code: 'decimal', max };
  const n = toInt(s);
  if (n === null) return { code: 'decimal', max };
  if (n < 1) return { code: 'min', max };
  if (n > max) return { code: overCode, max };
  return null;
}

export const issueQtyError = (text: string, stock: number) => qtyError(text, Math.min(stock, STOCK_QTY_MAX), 'overStock');
export const purchaseQtyError = (text: string) => qtyError(text, STOCK_QTY_MAX, 'max');
