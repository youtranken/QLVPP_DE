import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { deleteTestUsers, devHeaders, removeTestItem, seedActiveUser } from './helpers';

const PNG = readFileSync('playwright/fixtures/item.png');

test.describe('PRD §10.10 quyền đọc ảnh', () => {
  test('member A mở ảnh dòng của B → 404; B và Hành chính → 200; ảnh món đang bán → A 200', async ({ request }, info) => {
    const suffix = `${Date.now()}-${info.project.name}`;
    const a = { 'x-dev-user-sub': `pw-fa-a-${suffix}`, 'x-dev-role': 'member' };
    const b = { 'x-dev-user-sub': `pw-fa-b-${suffix}`, 'x-dev-role': 'member' };
    const admin = devHeaders('admin');
    seedActiveUser(b['x-dev-user-sub'], `PW Ảnh B ${info.project.name}`);
    const upload = async (headers: Record<string, string>, purpose: string) => {
      const res = await request.post('/api/files', {
        headers,
        multipart: { purpose, file: { name: 'a.png', mimeType: 'image/png', buffer: PNG } },
      });
      expect(res.status()).toBe(201);
      return (await res.json()).id as string;
    };
    let itemId: string | undefined;
    try {
      const period = await (await request.get('/api/periods/current', { headers: b })).json();
      const lineImg = await upload(b, 'line_image');
      const saved = await request.put('/api/me/request/lines', {
        headers: b,
        data: {
          ym: period.ym,
          lines: [{ custom_name: 'PW Bìa riêng', custom_unit: 'cai', image_file_id: lineImg, qty: 1 }],
        },
      });
      expect(saved.status()).toBe(200);

      expect((await request.get(`/api/files/${lineImg}`, { headers: a })).status()).toBe(404);
      expect((await request.get(`/api/files/${lineImg}`, { headers: b })).status()).toBe(200);
      expect((await request.get(`/api/files/${lineImg}`, { headers: admin })).status()).toBe(200);

      const itemImg = await upload(admin, 'item_image');
      const item = await request.post('/api/admin/items', {
        headers: admin,
        data: { name: `PW Ảnh món ${suffix}`, unit: 'cai', image_file_id: itemImg },
      });
      expect(item.status()).toBe(201);
      itemId = (await item.json()).id as string;
      const shown = await request.get(`/api/files/${itemImg}`, { headers: a });
      expect(shown.status()).toBe(200);
      expect(shown.headers()['content-type']).toContain('image/png');
    } finally {
      if (itemId) await removeTestItem(request, itemId);
      deleteTestUsers(b['x-dev-user-sub']);
    }
  });
});
