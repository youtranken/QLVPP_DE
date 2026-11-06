import { Controller, Get } from '@nestjs/common';
import { ADMIN_ROUTE_CLASSES } from '../src/modules/periods/admin-route-classes';
import type { RouteClass } from '../src/modules/periods/admin-route-classes';
import { Roles } from '../src/modules/auth/roles.decorator';
import { createTestApp } from './test-app.helper';
import { unclassifiedAdminRoutes } from './admin-routes.helper';
import { deliveryFixture } from './delivery.fixture';

const OPEN = '2026-11';
const LAST_OPEN_MS = '2026-11-10T16:59:59.999Z';
const FIRST_LOCKED_MS = '2026-11-10T17:00:00.000Z';
const METHOD_ORDER = ['GET', 'POST', 'PUT', 'DELETE'];

@Controller('admin/zz-unclassified-probe')
@Roles('admin')
class UnclassifiedProbeController {
  @Get()
  probe() {
    return {};
  }
}

describe('phân loại route /admin/* và guard kỳ khóa (e2e)', () => {
  const f = deliveryFixture('rcls');
  const { A, ADMIN, as, http, freeze, newItem, pool, seed, upload } = f;
  const ids = {
    request: '',
    itemLine: '',
    customLine: '',
    snapshot: '',
    img: '',
    item: '',
    updatedAt: '',
  };

  beforeEach(async () => {
    ids.item = await newItem();
    ids.img = await upload(A);
    const r = await seed([
      { item_id: ids.item, qty: 2 },
      {
        custom_name: 'Bìa phân loại',
        custom_unit: 'cai',
        image_file_id: ids.img,
        qty: 1,
      },
    ]);
    ids.request = r.id;
    ids.updatedAt = r.updated_at;
    ids.itemLine = r.lines.find((l) => l.item_id)!.id;
    ids.customLine = r.lines.find((l) => !l.item_id)!.id;
    freeze(FIRST_LOCKED_MS);
    ids.snapshot = (
      (
        await as(
          http().post(`/api/admin/reports/${OPEN}/snapshots`),
          ADMIN,
          'admin',
        )
          .send({ kind: 'xlsx' })
          .expect(201)
      ).body as { id: string }
    ).id;
    f.at('2026-11-05T03:00:00Z');
  });

  afterEach(async () => {
    await pool().query(
      'DELETE FROM report_snapshots WHERE created_by_sub = $1',
      [ADMIN],
    );
    await pool().query('DELETE FROM period_adm_out WHERE marked_by = $1', [
      ADMIN,
    ]);
    await pool().query('DELETE FROM custom_receipts WHERE created_by = $1', [
      ADMIN,
    ]);
  });

  const pathOf = (route: string) =>
    route
      .split(' ')[1]
      .replace(':ym', OPEN)
      .replace(/requests\/:id/, `requests/${ids.request}`)
      .replace(/lines\/:id/, `lines/${ids.customLine}`)
      .replace(/snapshots\/:id/, `snapshots/${ids.snapshot}`)
      .replace(':line_key', ids.item);

  const bodyOf = (route: string): object | undefined => {
    if (route.endsWith('/stock/receipts')) {
      return {
        ym: OPEN,
        lines: [{ item_id: ids.item, qty: 1, expected_stock_qty: 0 }],
      };
    }
    if (route.endsWith('/snapshots')) return { kind: 'print' };
    if (route.endsWith('/custom-receipts')) {
      return { line_key: 'custom:["bìa phân loại", "cai"]', qty: 1 };
    }
    if (route.endsWith('/lines')) {
      return {
        lines: [{ item_id: ids.item, qty: 1 }],
        expected_updated_at: ids.updatedAt,
        reason: 'Giảm thử',
      };
    }
    if (route.endsWith('/deliver'))
      return { qty: 1, expected_delivered_qty: 0 };
    if (route.endsWith('/cancel-remaining'))
      return { reason: 'Hủy thử', expected_delivered_qty: 0, expected_qty: 1 };
    if (route.endsWith('/review')) return { action: 'accept' };
    return undefined;
  };

  const call = (route: string, role = 'admin') => {
    const [method] = route.split(' ');
    const req = as(
      http()[method.toLowerCase() as 'get' | 'post' | 'put' | 'delete'](
        pathOf(route),
      ),
      ADMIN,
      role,
    );
    const body = bodyOf(route);
    return body ? req.send(body) : req;
  };

  const routesOf = (...classes: RouteClass[]) =>
    Object.entries(ADMIN_ROUTE_CLASSES)
      .filter(([, c]) => classes.includes(c))
      .map(([r]) => r)
      // Ghi sau đọc, sửa phiếu sau cùng: ở mốc đã khóa PUT bỏ dòng ngoài DM mà các route theo dòng còn dùng
      .sort(
        (a, b) =>
          METHOD_ORDER.indexOf(a.split(' ')[0]) -
          METHOD_ORDER.indexOf(b.split(' ')[0]),
      );

  it('mọi route /api/admin/* đã đăng ký đều có lớp trong ADMIN_ROUTE_CLASSES', () => {
    expect(unclassifiedAdminRoutes(f.app())).toEqual([]);
  });

  it('route /admin/* giả chưa phân loại → bộ kiểm báo đúng tên route', async () => {
    const probe = await createTestApp([UnclassifiedProbeController]);
    try {
      expect(unclassifiedAdminRoutes(probe)).toEqual([
        'GET /api/admin/zz-unclassified-probe',
      ]);
    } finally {
      await probe.close();
    }
  });

  it('mọi route by-ym/by-id gọi trên phiếu kỳ mở lúc 16:59:59.999Z ngày 10 → 409 PERIOD_NOT_LOCKED {ym, deadline}', async () => {
    freeze(LAST_OPEN_MS);
    const wrong: string[] = [];
    for (const route of routesOf('by-ym', 'by-id')) {
      const res = await call(route);
      const body = res.body as {
        code?: string;
        ym?: string;
        deadline?: string;
      };
      if (
        res.status !== 409 ||
        body.code !== 'PERIOD_NOT_LOCKED' ||
        body.ym !== OPEN ||
        body.deadline !== FIRST_LOCKED_MS
      ) {
        wrong.push(`${route} → ${res.status} ${body.code}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('lúc 17:00:00.000Z cùng các route không còn PERIOD_NOT_LOCKED; route GET trả 2xx', async () => {
    freeze(FIRST_LOCKED_MS);
    const wrong: string[] = [];
    for (const route of routesOf('by-ym', 'by-id')) {
      const res = await call(route);
      const code = (res.body as { code?: string }).code;
      const ok = route.startsWith('GET ')
        ? res.status < 300
        : code !== 'PERIOD_NOT_LOCKED';
      if (!ok) wrong.push(`${route} → ${res.status} ${code}`);
    }
    expect(wrong).toEqual([]);
  });

  it('by-ym: ym = kỳ mở + 1 → 400 INVALID_PERIOD; ym khóa không có dòng periods → không 409', async () => {
    freeze(LAST_OPEN_MS);
    await as(
      http().get('/api/admin/periods/2026-12/requests'),
      ADMIN,
      'admin',
    ).expect(400, /INVALID_PERIOD/);
    await as(http().get('/api/admin/reports/2026-12'), ADMIN, 'admin').expect(
      400,
      /INVALID_PERIOD/,
    );
    await as(
      http().get('/api/admin/periods/2003-02/requests'),
      ADMIN,
      'admin',
    ).expect(200);
    await as(http().get('/api/admin/reports/2003-02'), ADMIN, 'admin').expect(
      200,
    );
  });

  describe('sql-filter: kết quả không chứa dòng kỳ mở', () => {
    const reviewIds = async () =>
      (
        (await as(http().get('/api/admin/review'), ADMIN, 'admin').expect(200))
          .body as { items: { line_id: string }[] }
      ).items.map((i) => i.line_id);
    const backlogIds = async () =>
      (
        (
          await as(
            http().get('/api/admin/backlog?by=person'),
            ADMIN,
            'admin',
          ).expect(200)
        ).body as { groups: { lines: { line_id: string }[] }[] }
      ).groups
        .flatMap((g) => g.lines)
        .map((l) => l.line_id);
    const auditIds = async (role: string) =>
      (
        (
          await as(
            http().get('/api/admin/audit?action=request.created&limit=100'),
            ADMIN,
            role,
          ).expect(200)
        ).body as { items: { objectId: string }[] }
      ).items.map((i) => i.objectId);

    it('GET /admin/review, /admin/backlog: .999 không có dòng kỳ mở; .000 có', async () => {
      freeze(LAST_OPEN_MS);
      expect(await reviewIds()).not.toContain(ids.customLine);
      expect(await backlogIds()).not.toContain(ids.itemLine);
      freeze(FIRST_LOCKED_MS);
      expect(await reviewIds()).toContain(ids.customLine);
      expect(await backlogIds()).toContain(ids.itemLine);
    });

    it('GET /admin/audit: vai admin không thấy request.created kỳ mở ở .999, thấy ở .000; vai sa luôn thấy', async () => {
      freeze(LAST_OPEN_MS);
      expect(await auditIds('admin')).not.toContain(ids.request);
      expect(await auditIds('sa')).toContain(ids.request);
      freeze(FIRST_LOCKED_MS);
      expect(await auditIds('admin')).toContain(ids.request);
    });
  });

  it('ảnh dòng ngoài DM kỳ mở: admin/sa → 404 FILE_NOT_FOUND, chủ dòng → 200; sau khóa admin → 200', async () => {
    freeze(LAST_OPEN_MS);
    await as(http().get(`/api/files/${ids.img}`), ADMIN, 'admin').expect(
      404,
      /FILE_NOT_FOUND/,
    );
    await as(http().get(`/api/files/${ids.img}`), ADMIN, 'sa').expect(
      404,
      /FILE_NOT_FOUND/,
    );
    await as(http().get(`/api/files/${ids.img}`), A).expect(200);
    freeze(FIRST_LOCKED_MS);
    await as(http().get(`/api/files/${ids.img}`), ADMIN, 'admin').expect(200);
  });
});
