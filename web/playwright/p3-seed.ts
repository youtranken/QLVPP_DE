import { readFileSync } from 'node:fs';
import { expect, type APIRequestContext, type TestInfo } from '@playwright/test';
import { deleteTestUsers, devHeaders, isMobile, psql } from './helpers';
import { prevYmOf } from './locked-request';

export type Person = { sub: string; name: string; headers: Record<string, string> };
export type Item = { id: string; name: string };

export interface MonthSeed {
  tag: string;
  ym: string;
  prevYm: string;
  a: Person;
  b: Person;
  paper: Item;
  pen: Item;
  clip: Item;
  custom: string;
  signers: Record<string, string>;
  cleanup: (since: string) => Promise<void>;
}

const sqlList = (xs: string[]) => xs.map((x) => `'${x}'`).join(', ');

function seedPeople(tag: string): [Person, Person] {
  const person = (k: string): Person => {
    const sub = `pw-p3-${k}-${tag}`;
    return { sub, name: `PW P3 ${k.toUpperCase()} ${tag}`, headers: { 'x-dev-user-sub': sub, 'x-dev-role': 'member' } };
  };
  const [a, b] = [person('a'), person('b')];
  psql(`INSERT INTO users (sub, full_name, email, department, status) VALUES
    ${[a, b].map((p) => `('${p.sub}', '${p.name}', '${p.sub}@example.test', 'PW Phòng P3', 'active')`).join(', ')}`);
  return [a, b];
}

// Món seed bằng SQL dùng lại một ảnh có sẵn để không tải tệp mới lên kho tệp
function seedItems(tag: string): [Item, Item, Item] {
  const fileId = psql(`SELECT id FROM files WHERE purpose = 'item_image' ORDER BY created_at LIMIT 1`);
  expect(fileId).not.toBe('');
  const item = (name: string, stock: number): Item => {
    const full = `${name} ${tag}`;
    return { name: full, id: psql(`INSERT INTO items (name, unit, image_file_id, stock_qty) VALUES ('${full}', 'cai', '${fileId}', ${stock}) RETURNING id`) };
  };
  return [item('PW Giấy A4', 3), item('PW Bút', 5), item('PW Kẹp', 0)];
}

async function uploadLineImage(request: APIRequestContext, owner: Person) {
  const img = await request.post('/api/files', {
    headers: owner.headers,
    multipart: { purpose: 'line_image', file: { name: 'l.png', mimeType: 'image/png', buffer: readFileSync('playwright/fixtures/item.png') } },
  });
  expect(img.status()).toBe(201);
  return (await img.json()).id as string;
}

// lines: (item_id, custom_name, custom_unit, image, qty, review_status, pos); created_at tăng theo pos → thứ tự dòng tất định
function insertRequest(owner: Person, ym: string, lines: string) {
  psql(`WITH r AS (
      INSERT INTO requests (period_ym, user_sub, created_by_sub, department) VALUES ('${ym}-01', '${owner.sub}', '${owner.sub}', 'PW Phòng P3') RETURNING id
    )
    INSERT INTO request_lines (request_id, item_id, custom_name, custom_unit, image_file_id, qty, review_status, created_at)
    SELECT r.id, x.item_id::uuid, x.custom_name, x.custom_unit, x.image::uuid, x.qty, x.status, now() + x.pos * interval '1 second'
    FROM r, (VALUES ${lines}) AS x(item_id, custom_name, custom_unit, image, qty, status, pos)`);
}

async function swapSigners(request: APIRequestContext, tag: string) {
  const headers = devHeaders('admin');
  const original = (await (await request.get('/api/admin/config', { headers })).json()).signers as Record<string, string>;
  const signers = { preparer: `PW Lập ${tag}`, head: `PW Trưởng ${tag}`, approver: `PW Duyệt ${tag}` };
  expect((await request.put('/api/admin/config', { headers, data: { signers } })).ok()).toBe(true);
  return { signers, restore: async () => void (await request.put('/api/admin/config', { headers, data: { signers: original } })) };
}

function removeSeed(s: Omit<MonthSeed, 'cleanup' | 'signers'>, createdPeriod: boolean, since: string) {
  const items = sqlList([s.paper, s.pen, s.clip].map((i) => i.id));
  const subs = sqlList([s.a.sub, s.b.sub]);
  psql(`DELETE FROM report_snapshots WHERE period_ym IN ('${s.prevYm}-01', '${s.ym}-01') AND created_at >= '${since}'
      AND created_by_sub IN ('pw-admin', 'local:sa');
    DELETE FROM line_deliveries WHERE line_id IN (
      SELECT l.id FROM request_lines l JOIN requests r ON r.id = l.request_id WHERE r.user_sub IN (${subs}));
    DELETE FROM stock_movements WHERE item_id IN (${items});
    DELETE FROM in_app_notifications WHERE user_sub IN (${subs})
      OR params->>'name' IN (${sqlList([s.paper, s.pen, s.clip].map((i) => i.name))})`);
  deleteTestUsers(s.a.sub, s.b.sub);
  psql(`DELETE FROM items WHERE id IN (${items})`);
  if (createdPeriod) psql(`DELETE FROM periods WHERE ym = '${s.prevYm}-01' AND NOT EXISTS (SELECT 1 FROM requests WHERE period_ym = '${s.prevYm}-01')`);
}

// Kỳ trước đã khóa (hạn đã qua) seed bằng SQL; A còn một phiếu kỳ đang mở để kiểm "nợ kỳ trước + đăng ký kỳ này"
export async function seedMonth(request: APIRequestContext, info: TestInfo): Promise<MonthSeed> {
  const tag = `${Date.now().toString(36)}${isMobile(info) ? 'm' : 'd'}`;
  const [a, b] = seedPeople(tag);
  const [paper, pen, clip] = seedItems(tag);
  const ym = (await (await request.get('/api/periods/current', { headers: a.headers })).json()).ym as string;
  const prevYm = prevYmOf(ym);
  const custom = `PW Bìa còng ${tag}`;
  const base = { tag, ym, prevYm, a, b, paper, pen, clip, custom };
  const createdPeriod =
    psql(`INSERT INTO periods (ym, deadline) VALUES ('${prevYm}-01', '${prevYm}-10T17:00:00Z') ON CONFLICT DO NOTHING RETURNING ym`) !== '';
  try {
    const imageId = await uploadLineImage(request, a);
    insertRequest(a, prevYm, `('${paper.id}', NULL, NULL, NULL, 5, 'n/a', 0), ('${pen.id}', NULL, NULL, NULL, 2, 'n/a', 1),
      (NULL, '${custom}', 'cai', '${imageId}', 1, 'accepted', 2)`);
    insertRequest(b, prevYm, `('${clip.id}', NULL, NULL, NULL, 3, 'n/a', 0)`);
    insertRequest(a, ym, `('${paper.id}', NULL, NULL, NULL, 3, 'n/a', 0)`);
    const { signers, restore } = await swapSigners(request, tag);
    const cleanup = async (since: string) => {
      await restore();
      removeSeed(base, createdPeriod, since);
    };
    return { ...base, signers, cleanup };
  } catch (error) {
    removeSeed(base, createdPeriod, new Date().toISOString());
    throw error;
  }
}

export const deliveryMovements = (itemId: string) =>
  psql(`SELECT coalesce(string_agg(delta::text, ',' ORDER BY created_at), '') FROM stock_movements WHERE item_id = '${itemId}' AND reason = 'delivery'`);
