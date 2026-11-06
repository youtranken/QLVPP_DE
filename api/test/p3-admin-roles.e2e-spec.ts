import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { addMonths } from '../src/common/period';
import { createTestApp } from './test-app.helper';

const MISSING = '00000000-0000-4000-8000-000000000000';

interface Route {
  method: 'get' | 'post';
  path: (ym: string) => string;
  body?: object;
  // Trạng thái khi qua được guard: id không có → 404, tháng sau kỳ mở → 400 INVALID_PERIOD (không ghi dữ liệu)
  allowed: [number, string?];
}

const ROUTES: Route[] = [
  {
    method: 'post',
    path: () => `/api/admin/lines/${MISSING}/deliver`,
    body: { qty: 1, expected_delivered_qty: 0 },
    allowed: [404, 'LINE_NOT_FOUND'],
  },
  {
    method: 'post',
    path: () => `/api/admin/requests/${MISSING}/deliver-all`,
    allowed: [404, 'REQUEST_NOT_FOUND'],
  },
  {
    method: 'post',
    path: () => `/api/admin/lines/${MISSING}/cancel-remaining`,
    body: {
      reason_code: 'not_needed',
      expected_delivered_qty: 0,
      expected_qty: 1,
    },
    allowed: [404, 'LINE_NOT_FOUND'],
  },
  { method: 'get', path: () => '/api/admin/backlog?by=item', allowed: [200] },
  {
    method: 'get',
    path: () => `/api/admin/lines/${MISSING}/deliveries`,
    allowed: [404, 'LINE_NOT_FOUND'],
  },
  { method: 'get', path: (ym) => `/api/admin/reports/${ym}`, allowed: [200] },
  {
    method: 'get',
    path: (ym) => `/api/admin/reports/${ym}/snapshots`,
    allowed: [200],
  },
  {
    method: 'post',
    path: () => '/api/admin/reports/2999-01/snapshots',
    body: { kind: 'xlsx' },
    allowed: [400, 'INVALID_PERIOD'],
  },
  {
    method: 'get',
    path: () => `/api/admin/reports/snapshots/${MISSING}`,
    allowed: [404, 'SNAPSHOT_NOT_FOUND'],
  },
  {
    method: 'get',
    path: () => `/api/admin/reports/snapshots/${MISSING}/export.xlsx?lang=vi`,
    allowed: [404, 'SNAPSHOT_NOT_FOUND'],
  },
];

describe('Quyền các route admin Plan 3: admin và sa qua guard, member 403', () => {
  let app: INestApplication<App>;
  let ym: string;

  const call = (r: Route, role: string) => {
    const server = app.getHttpServer();
    const req =
      r.method === 'get'
        ? request(server).get(r.path(ym))
        : request(server)
            .post(r.path(ym))
            .send(r.body ?? {});
    return req
      .set('x-dev-user-sub', `e2e-p3-roles-${role}`)
      .set('x-dev-role', role);
  };

  beforeAll(async () => {
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp()) as INestApplication<App>;
    const open = (
      await request(app.getHttpServer())
        .get('/api/periods/current')
        .set('x-dev-user-sub', 'e2e-p3-roles-admin')
        .set('x-dev-role', 'admin')
    ).body.ym as string;
    // Route theo tháng chỉ mở cho kỳ đã khóa: dùng kỳ liền trước kỳ đang mở
    ym = addMonths(open, -1);
  });

  afterAll(async () => {
    await app.close();
    delete process.env.AUTH_DEV_MODE;
  });

  it.each(
    ROUTES.map((r) => [`${r.method.toUpperCase()} ${r.path('<ym>')}`, r]),
  )(
    '%s: admin và sa → trạng thái nghiệp vụ (không 401/403), member → 403',
    async (_name, r) => {
      for (const role of ['admin', 'sa']) {
        const res = await call(r, role);
        expect([role, res.status, res.body.code]).toEqual([
          role,
          r.allowed[0],
          r.allowed[1] ?? res.body.code,
        ]);
      }
      const member = await call(r, 'member');
      expect(member.status).toBe(403);
    },
  );
});
