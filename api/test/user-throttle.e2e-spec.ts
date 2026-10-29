import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

describe('throttle theo user (sau Roles)', () => {
  let app: INestApplication<App>;
  const saved = {
    perMin: process.env.THROTTLE_USER_PER_MIN,
    dev: process.env.AUTH_DEV_MODE,
  };

  function restore(key: string, value: string | undefined): void {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  beforeAll(async () => {
    assertTestDatabase(process.env.DATABASE_URL);
    process.env.THROTTLE_USER_PER_MIN = '5';
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp()) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
    restore('THROTTLE_USER_PER_MIN', saved.perMin);
    restore('AUTH_DEV_MODE', saved.dev);
  });

  const current = (sub: string) =>
    request(app.getHttpServer())
      .get('/api/periods/current')
      .set('x-dev-user-sub', sub)
      .set('x-dev-role', 'member');

  it('ngưỡng 5/phút: user X 5 lần 200, lần 6 → 429; user Y cùng IP vẫn 200', async () => {
    for (let i = 0; i < 5; i += 1) {
      await current('e2e-thr-user-x').expect(200);
    }
    await current('e2e-thr-user-x').expect(429);
    await current('e2e-thr-user-y').expect(200);
  });
});
