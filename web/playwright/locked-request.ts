import { type APIRequestContext, type TestInfo } from '@playwright/test';
import { devHeaders, isMobile, psql, seedActiveUser } from './helpers';

export const prevYmOf = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};

export interface Seed {
  tag: string;
  sub: string;
  name: string;
  prevYm: string;
  requestId: string;
  items: { id: string; name: string }[];
  cleanup: () => void;
}

// Kỳ trước đã khóa (hạn đã qua) seed bằng SQL; món không ảnh để không phụ thuộc kho tệp đang có gì. ym: seed vào kỳ đã khóa khác (kỳ riêng của PW)
export async function seedLockedRequest(request: APIRequestContext, info: TestInfo, lines: { stock: number; qty: number }[], ym?: string): Promise<Seed> {
  const tag = `${Date.now().toString(36)}${isMobile(info) ? 'm' : 'd'}`;
  const sub = `pw-dlv-${tag}`;
  const name = `PW Giao ${tag}`;
  const prevYm = ym ?? prevYmOf((await (await request.get('/api/periods/current', { headers: devHeaders('admin') })).json()).ym);
  seedActiveUser(sub, name, 'active', { department: 'PW Phòng giao' });
  const items = lines.map((l, i) => {
    const itemName = `PW món ${String.fromCharCode(65 + i)} ${tag}`;
    const id = psql(`INSERT INTO items (name, unit, stock_qty)
      VALUES ('${itemName}', 'cai', ${l.stock}) RETURNING id`);
    return { id, name: itemName };
  });
  const createdPeriod = psql(
    `INSERT INTO periods (ym, deadline) VALUES ('${prevYm}-01', '${prevYm}-10T17:00:00Z') ON CONFLICT DO NOTHING RETURNING ym`,
  );
  // created_at tăng dần theo thứ tự seed: listLines xếp theo created_at, id → thứ tự dòng và ảnh chụp tất định
  const values = lines.map((l, i) => `('${items[i].id}', ${l.qty}, ${i})`).join(', ');
  const requestId = psql(`WITH r AS (
      INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ('${prevYm}-01', '${sub}', '${sub}') RETURNING id
    ), l AS (
      INSERT INTO request_lines (request_id, item_id, qty, created_at)
      SELECT r.id, x.item_id::uuid, x.qty, now() + x.pos * interval '1 second'
      FROM r, (VALUES ${values}) AS x(item_id, qty, pos)
    )
    SELECT id FROM r`);
  const ids = items.map((i) => `'${i.id}'`).join(', ');
  const cleanup = () => {
    psql(`DELETE FROM line_deliveries WHERE line_id IN (
        SELECT l.id FROM request_lines l JOIN requests r ON r.id = l.request_id WHERE r.user_sub = '${sub}');
      DELETE FROM stock_movements WHERE item_id IN (${ids});
      DELETE FROM in_app_notifications WHERE user_sub = '${sub}';
      DELETE FROM requests WHERE user_sub = '${sub}';
      DELETE FROM items WHERE id IN (${ids});
      DELETE FROM users WHERE sub = '${sub}'`);
    if (createdPeriod) psql(`DELETE FROM periods WHERE ym = '${prevYm}-01' AND NOT EXISTS (SELECT 1 FROM requests WHERE period_ym = '${prevYm}-01')`);
  };
  return { tag, sub, name, prevYm, requestId, items, cleanup };
}

export const stockOf = (id: string) => Number(psql(`SELECT stock_qty FROM items WHERE id = '${id}'`));

export interface CustomLine {
  name: string;
  qty: number;
  note?: string;
  imageId?: string;
}

// Dòng ngoài danh mục ở kỳ trước đã khóa: Hành chính chỉ thấy món ngoài DM của kỳ đã khóa.
// Gọi trong acquireLock('prev-period'); cleanup chỉ xóa kỳ nếu chính hàm này tạo và kỳ không còn phiếu.
export async function seedLockedCustomLines(request: APIRequestContext, sub: string, lines: CustomLine[]) {
  const period = await (await request.get('/api/periods/current', { headers: devHeaders('admin') })).json();
  const prevYm = prevYmOf(period.ym);
  const createdPeriod = psql(
    `INSERT INTO periods (ym, deadline) VALUES ('${prevYm}-01', '${prevYm}-10T17:00:00Z') ON CONFLICT DO NOTHING RETURNING ym`,
  );
  const sqlText = (v: string | undefined) => (v === undefined ? 'NULL' : `'${v.replace(/'/g, "''")}'`);
  const values = lines
    .map((l, i) => `(${sqlText(l.name)}, ${sqlText(l.note)}, ${l.imageId ? `'${l.imageId}'::uuid` : 'NULL::uuid'}, ${l.qty}, ${i})`)
    .join(', ');
  const requestId = psql(`WITH r AS (
      INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ('${prevYm}-01', '${sub}', '${sub}') RETURNING id
    ), l AS (
      INSERT INTO request_lines (request_id, custom_name, custom_unit, custom_note, image_file_id, qty, review_status, created_at)
      SELECT r.id, x.name, 'cai', x.note, x.img, x.qty, 'pending', now() + x.pos * interval '1 second'
      FROM r, (VALUES ${values}) AS x(name, note, img, qty, pos)
    )
    SELECT id FROM r`);
  const cleanup = () => {
    if (createdPeriod) psql(`DELETE FROM periods WHERE ym = '${prevYm}-01' AND NOT EXISTS (SELECT 1 FROM requests WHERE period_ym = '${prevYm}-01')`);
  };
  return { prevYm, requestId, cleanup };
}
