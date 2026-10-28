import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PG_POOL } from '../src/database/database.module';
import { createTestApp } from './test-app.helper';

describe('Health (khung api)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = (await createTestApp()) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health → 200 { status: ok }', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('Health khi Postgres không tới được', () => {
  let app: INestApplication<App>;
  const deadPool = {
    query: () => Promise.reject(new Error('connect ECONNREFUSED')),
    connect: () => Promise.reject(new Error('connect ECONNREFUSED')),
    end: () => Promise.resolve(),
    on: () => undefined,
  };

  beforeAll(async () => {
    app = (await createTestApp(
      [],
      [{ token: PG_POOL, useValue: deadPool }],
    )) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health → 503 { status: db_unavailable }', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect(503);
    expect(res.body).toEqual({ status: 'db_unavailable' });
  });
});
