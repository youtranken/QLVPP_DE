import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { deleteTestUsers, devHeaders, removeTestItem, seedActiveUser } from './helpers';

const PNG = readFileSync('playwright/fixtures/item.png');

test.describe('PRD §10.10 quyền đọc ảnh', () => {
  test('member A mở ảnh dòng của B → 404 FILE_NOT_FOUND; A mở ảnh dòng của chính mình, B → 200; Adm D&E kỳ đang mở → 404; ảnh món đang bán → A 200', async ({ request }, info) => {
    const suffix = `${Date.now()}-${info.project.name}`;
    const a = { 'x-dev-user-sub': `pw-fa-a-${suffix}`, 'x-dev-role': 'member' };
    const b = { 'x-dev-user-sub': `pw-fa-b-${suffix}`, 'x-dev-role': 'member' };
    const admin = devHeaders('admin');
    seedActiveUser(a['x-dev-user-sub'], `PW Ảnh A ${info.project.name}`);
    seedActiveUser(b['x-dev-user-sub'], `PW Ảnh B ${info.project.name}`);
    const upload = async (headers: Record<string, string>, purpose: string) => {
      const res = await request.post('/api/files', {
        headers,
        multipart: { purpose, file: { name: 'a.png', mimeType: 'image/png', buffer: PNG } },
      });
      expect(res.status()).toBe(201);
      return (await res.json()).id as string;
    };
    const saveLineWithImage = async (headers: Record<string, string>, ym: string) => {
      const image = await upload(headers, 'line_image');
      const saved = await request.put('/api/me/request/lines', {
        headers,
        data: { ym, lines: [{ custom_name: 'PW Bìa riêng', custom_unit: 'cai', image_file_id: image, qty: 1 }] },
      });
      expect(saved.status()).toBe(200);
      return image;
    };
    let itemId: string | undefined;
    try {
      const period = await (await request.get('/api/periods/current', { headers: b })).json();
      const lineImg = await saveLineWithImage(b, period.ym);
      const ownImg = await saveLineWithImage(a, period.ym);

      const denied = await request.get(`/api/files/${lineImg}`, { headers: a });
      expect(denied.status()).toBe(404);
      expect(await denied.json()).toMatchObject({ code: 'FILE_NOT_FOUND' });
      expect((await request.get(`/api/files/${ownImg}`, { headers: a })).status()).toBe(200);
      expect((await request.get(`/api/files/${lineImg}`, { headers: b })).status()).toBe(200);
      // Kỳ đang mở: Hành chính chưa thấy ảnh dòng ngoài DM (chỉ làm việc trên kỳ đã khóa)
      expect((await request.get(`/api/files/${lineImg}`, { headers: admin })).status()).toBe(404);

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
      deleteTestUsers(a['x-dev-user-sub'], b['x-dev-user-sub']);
    }
  });
});
