import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { FilesService } from '../src/modules/files/files.service';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

// Mô phỏng race: kiểm quyền ảnh đã qua thì job dọn tệp mồ côi xóa bản ghi files trước khi INSERT món
const filesPassedCheck = { assertOwnedBy: () => Promise.resolve() };

describe('catalog: ảnh bị dọn giữa lúc kiểm và lúc ghi', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    assertTestDatabase(process.env.DATABASE_URL);
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp(
      [],
      [{ token: FilesService, useValue: filesPassedCheck }],
    )) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
    delete process.env.AUTH_DEV_MODE;
  });

  it('image_file_id không còn trong files (FK items_image_file_id_fkey) → 400 IMAGE_REQUIRED, không 500', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/admin/items')
      .set('x-dev-user-sub', 'e2e-cat-race')
      .set('x-dev-role', 'admin')
      .send({
        name: `Ảnh bị dọn ${randomUUID()}`,
        unit: 'cay',
        image_file_id: randomUUID(),
      })
      .expect(400);
    expect(res.body.code).toBe('IMAGE_REQUIRED');
  });
});
