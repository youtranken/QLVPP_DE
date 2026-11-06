import { readFileSync } from 'node:fs';
import { expect, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import { deleteTestUsers, devHeaders, psql, removeTestItem, seedActiveUser } from './helpers';

// Mỗi lần chạy một người riêng: phiếu là 1 người/kỳ nên hai viewport không được dùng chung danh tính
export function memberIdentity(info: TestInfo) {
  const sub = `pw-req-${Date.now()}-${info.project.name}`;
  return { sub, headers: { 'x-dev-user-sub': sub, 'x-dev-role': 'member' } };
}

// Người thử riêng + gắn dev-identity cho mọi lời gọi api của trang; dọn bằng deleteTestUsers(me.sub)
export async function asNewMember(page: Page, info: TestInfo) {
  const me = memberIdentity(info);
  seedActiveUser(me.sub, `PW Nhân viên ${info.project.name}`);
  await page.route('**/api/**', (route) => route.continue({ headers: { ...route.request().headers(), ...me.headers } }));
  return me;
}

export async function shotTo(page: Page, info: TestInfo, name: string, dir = 'task-C4') {
  await page.screenshot({ path: `../live-real/v2c/${dir}/${name}-${info.project.name}.png`, fullPage: false });
}

async function uploadImage(request: APIRequestContext): Promise<string> {
  const file = await request.post('/api/files', {
    headers: devHeaders('admin'),
    multipart: {
      purpose: 'item_image',
      file: { name: 'item.png', mimeType: 'image/png', buffer: readFileSync('playwright/fixtures/item.png') },
    },
  });
  expect(file.status()).toBe(201);
  return (await file.json()).id as string;
}

export async function createItem(
  request: APIRequestContext,
  name: string,
  opts: { maxQty?: number; categoryId?: string; imageId?: string } = {},
) {
  const item = await request.post('/api/admin/items', {
    headers: devHeaders('admin'),
    data: {
      name,
      unit: 'cai',
      max_qty: opts.maxQty ?? 99,
      image_file_id: opts.imageId ?? (await uploadImage(request)),
      ...(opts.categoryId ? { category_id: opts.categoryId } : {}),
    },
  });
  expect(item.status()).toBe(201);
  return (await item.json()).id as string;
}

// Nhóm thử riêng có đúng n món (dùng chung một ảnh): test lưới/phiếu không phụ thuộc cỡ và thứ tự danh mục thật.
// Mở bằng `/?g=<categoryId>`; dọn: món (ngừng nếu còn dòng phiếu) rồi nhóm (xóa nếu trống, không thì ngừng)
export async function createTestGroup(request: APIRequestContext, info: TestInfo, n: number) {
  const stamp = `${Date.now()}-${info.project.name}`;
  const cat = await request.post('/api/admin/item-categories', { headers: devHeaders('admin'), data: { name: `PW nhóm rq ${stamp}` } });
  expect(cat.status()).toBe(201);
  const categoryId = (await cat.json()).id as string;
  const imageId = await uploadImage(request);
  const items: { id: string; name: string }[] = [];
  for (let i = 1; i <= n; i++) {
    const name = `PW g${String(i).padStart(2, '0')} ${stamp.slice(-9)}`;
    items.push({ id: await createItem(request, name, { categoryId, imageId }), name });
  }
  return {
    categoryId,
    items,
    cleanup: async (memberSub: string) => {
      deleteTestUsers(memberSub);
      for (const it of items) await removeTestItem(request, it.id);
      psql(`DELETE FROM item_categories c WHERE c.id = '${categoryId}' AND NOT EXISTS (SELECT 1 FROM items i WHERE i.category_id = c.id)`);
      psql(`UPDATE item_categories SET active = false WHERE id = '${categoryId}'`);
    },
  };
}
