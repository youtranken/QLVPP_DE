export type HeldStockState =
  'short' | 'incoming' | 'none' | 'low' | 'untracked' | 'ok';

export interface HeldStockInput {
  stock_qty: number;
  held: number;
  restock_level: number | null;
  incoming: number;
}

export interface HeldStock {
  free: number;
  short: number;
  awaiting: number;
  stock_state: HeldStockState;
}

// Cùng ngưỡng với LOW_STOCK_SQL (đã dùng 80 % lần nhập gần nhất) nhưng tính trên phần còn trống
const lowLine = (level: number) => Math.floor(level * 0.2);

export function stockStateOf(x: HeldStockInput): HeldStock {
  const free = Math.max(0, x.stock_qty - x.held);
  const gap = Math.max(0, x.held - x.stock_qty);
  const short = Math.max(0, gap - x.incoming);
  const awaiting = Math.min(x.incoming, gap);
  const state = (): HeldStockState => {
    if (short > 0) return 'short';
    if (awaiting > 0) return 'incoming';
    if (x.stock_qty === 0 && x.held === 0) return 'none';
    if (x.restock_level === null) return 'untracked';
    if (x.restock_level > 0 && free <= lowLine(x.restock_level)) return 'low';
    return 'ok';
  };
  return { free, short, awaiting, stock_state: state() };
}

export type StockState = 'ok' | 'low' | 'out' | 'untracked' | 'incoming';

// Danh mục, Home và chuông đọc đúng trạng thái Tủ: thiếu cho người chờ là Sắp hết (còn hàng) hoặc Hết hàng (tủ 0);
// thiếu mà hàng đang về đủ bù là "Chờ hàng về", không bao giờ là Sắp hết
export function catalogStateOf(stock_qty: number, s: HeldStockState): StockState {
  if (s === 'short') return stock_qty === 0 ? 'out' : 'low';
  if (s === 'none') return 'out';
  return s;
}
