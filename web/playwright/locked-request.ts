import { expect, type APIRequestContext, type TestInfo } from '@playwright/test';
import { devHeaders, isMobile, psql } from './helpers';

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

// Kỳ trước đã khóa (hạn đã qua) seed bằng SQL; món tạo bằng SQL dùng lại một ảnh có sẵn để không tải tệp mới lên kho tệp
export async function seedLockedRequest(request: APIRequestContext, info: TestInfo, lines: { stock: number; qty: number }[]): Promise<Seed> {
  const tag = `${Date.now().toString(36)}${isMobile(info) ? 'm' : 'd'}`;
  const sub = `pw-dlv-${tag}`;
  const name = `PW Giao ${tag}`;
  const period = await (await request.get('/api/periods/current', { headers: devHeaders('admin') })).json();
  const prevYm = prevYmOf(period.ym);
  const fileId = psql(`SELECT id FROM files WHERE purpose = 'item_image' ORDER BY created_at LIMIT 1`);
  expect(fileId).not.toBe('');
  psql(`INSERT INTO users (sub, full_name, email, department, status)
    VALUES ('${sub}', '${name}', '${sub}@example.test', 'PW Phòng giao', 'active')`);
  const items = lines.map((l, i) => {
    const itemName = `PW món ${String.fromCharCode(65 + i)} ${tag}`;
    const id = psql(`INSERT INTO items (name, unit, image_file_id, stock_qty)
      VALUES ('${itemName}', 'cai', '${fileId}', ${l.stock}) RETURNING id`);
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
