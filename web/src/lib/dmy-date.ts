export type DmyParse = { kind: 'empty' } | { kind: 'ok'; iso: string } | { kind: 'invalid' };

// Bàn phím số điện thoại không có '/', nên nhận cả 8 chữ số liền ddmmyyyy
const DMY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$|^(\d{2})(\d{2})(\d{4})$/;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
// Khớp DATE_FROM_2000 của api: ngày trước 2000 bị từ chối
const MIN_YEAR = 2000;

const pad = (n: number) => String(n).padStart(2, '0');
const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

export function parseDmy(text: string): DmyParse {
  const s = text.trim();
  if (s === '') return { kind: 'empty' };
  const m = DMY.exec(s);
  if (!m) return { kind: 'invalid' };
  const [day, month, year] = [Number(m[1] ?? m[4]), Number(m[2] ?? m[5]), Number(m[3] ?? m[6])];
  if (year < MIN_YEAR || month < 1 || month > 12 || day < 1 || day > daysIn(year, month)) return { kind: 'invalid' };
  return { kind: 'ok', iso: `${year}-${pad(month)}-${pad(day)}` };
}

export function isoToDmy(iso: string): string {
  const m = ISO.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
