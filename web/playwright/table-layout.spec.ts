import { expect, test, type Page } from '@playwright/test';
import { acquireLock, asRole, deleteTestUsers, isMobile, psql, removeTestItem, seedActiveUser, seedPwItem, skipNewPeriodPopup } from './helpers';

// Hai lỗi bảng lọt qua nhiều vòng vì không ai đo:
// (1) màn vừa 768–1024: khung bảng clip (để đầu nhóm dính theo trang) mà bảng rộng hơn khung → mất cột Thao tác, không cuộn được;
// (2) đổi tab / tháng / lọc làm cột dời chỗ hoặc bảng bị đẩy xuống.
// Chỉ desktop: 390 xếp bảng thành thẻ

interface Box {
  xs: number[];
  ws: number[];
  top: number;
}

// x, bề rộng từng tiêu đề cột và đỉnh bảng (tính cả cuộn) của bảng đầu tiên; null khi không có bảng hay bảng rỗng (đầu cột ẩn)
async function tableBox(page: Page, selector = 'table'): Promise<Box | null> {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  return page.evaluate((sel) => {
    const table = [...document.querySelectorAll<HTMLTableElement>(sel)].find((t) => t.getClientRects().length > 0);
    const ths = table ? [...(table.querySelector(':scope > thead > tr')?.children ?? [])] : [];
    const boxes = ths.map((th) => th.getBoundingClientRect());
    if (!table || boxes.every((b) => b.width === 0)) return null;
    return { xs: boxes.map((b) => Math.round(b.left)), ws: boxes.map((b) => Math.round(b.width)), top: Math.round(table.getBoundingClientRect().top + scrollY) };
  }, selector);
}

async function expectSameBox(page: Page, base: Box, where: string, selector?: string) {
  const now = await tableBox(page, selector);
  // Lọc ra rỗng thì bảng ẩn đầu cột: không có gì để so
  if (!now) return;
  for (const [i, x] of base.xs.entries()) {
    expect(Math.abs(now.xs[i] - x), `${where}: cột ${i} dời ngang`).toBeLessThanOrEqual(2);
    expect(Math.abs(now.ws[i] - base.ws[i]), `${where}: cột ${i} đổi bề rộng`).toBeLessThanOrEqual(2);
  }
  expect(Math.abs(now.top - base.top), `${where}: bảng bị đẩy dọc`).toBeLessThanOrEqual(2);
}

test.describe('Bảng quản lý', () => {
  asRole('admin');

  const ROUTES = ['/admin/month', '/admin/reports', '/admin/backlog', '/admin/delivery?tab=all', '/admin/arrivals', '/admin/stock', '/admin/users', '/admin/audit', '/admin/catalog?view=table', '/admin/categories'];

  for (const width of [768, 900, 1024]) {
    test(`Vòng8 ${width}px: không bảng nào bị cắt trong khung không cuộn được`, async ({ page }, info) => {
      test.skip(isMobile(info), '390 xếp bảng thành thẻ');
      await page.setViewportSize({ width, height: 900 });
      for (const route of ROUTES) {
        await page.goto(route);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
        const problems = await page.evaluate(() => {
          const out: string[] = [];
          for (const table of document.querySelectorAll('table')) {
            if (!table.getClientRects().length) continue;
            // Khung gần nhất không để tràn tự do: bảng rộng hơn nó thì phải cuộn được (auto/scroll), không được clip/hidden
            let wrap = table.parentElement;
            while (wrap && wrap !== document.body && getComputedStyle(wrap).overflowX === 'visible') wrap = wrap.parentElement;
            if (!wrap || wrap === document.body) continue;
            const ox = getComputedStyle(wrap).overflowX;
            if (ox === 'auto' || ox === 'scroll') continue;
            const name = table.getAttribute('aria-label') ?? table.className;
            if (table.scrollWidth > wrap.clientWidth + 1) out.push(`${name}: bảng ${table.scrollWidth}px trong khung ${wrap.clientWidth}px overflow-x ${ox}`);
            const right = wrap.getBoundingClientRect().right;
            const lost = [...table.querySelectorAll('button, a, input')].filter((el) => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.right > right + 1;
            });
            if (lost.length) out.push(`${name}: ${lost.length} nút nằm ngoài mép phải khung (${ox})`);
          }
          return out;
        });
        expect(problems, `${route} @${width}px`).toEqual([]);
      }
    });
  }

  // Máy tính: ô chọn trong bảng là vùng bấm 44px (ô vuông 18px vẽ ở giữa), như ở điện thoại
  test('Vòng8 1280px: ô chọn trong bảng có vùng bấm 44×44', async ({ page }, info) => {
    test.skip(isMobile(info), '390 đã đo ở admin-mobile.spec');
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const route of ['/admin/catalog?view=table', '/admin/delivery?tab=all', '/admin/arrivals']) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      const small = await page.locator('table input[type="checkbox"]').evaluateAll((boxes) =>
        boxes
          .map((b) => b.getBoundingClientRect())
          .filter((r) => r.width > 0 && (r.width < 44 || r.height < 44))
          .map((r) => `${Math.round(r.width)}×${Math.round(r.height)}`),
      );
      expect(small, route).toEqual([]);
    }
  });

  // Trạng thái ghi trong URL; base là trạng thái gốc. Cột (x, bề rộng) và đỉnh bảng phải giữ nguyên
  const STATES: { name: string; base: string; states: string[] }[] = [
    { name: 'Giao hàng', base: '/admin/delivery', states: ['/admin/delivery?tab=debt', '/admin/delivery?tab=done', '/admin/delivery?tab=all'] },
    { name: 'Tủ / Kho', base: '/admin/stock', states: ['/admin/stock?filter=incoming', '/admin/stock?filter=low', '/admin/stock?filter=none'] },
    { name: 'Danh bạ', base: '/admin/users', states: ['/admin/users?status=active', '/admin/users?status=locked', '/admin/users?reg=no'] },
    { name: 'Nhật ký', base: '/admin/audit', states: ['/admin/audit?action=stock.receipt', '/admin/audit?action=auth.login_denied_idp'] },
  ];

  for (const width of [1280, 1024]) {
    for (const c of STATES) {
      test(`Vòng8 ${c.name} ${width}px: đổi tab/lọc không dời cột, không đẩy bảng`, async ({ page }, info) => {
        test.skip(isMobile(info), '390 xếp bảng thành thẻ');
        await page.setViewportSize({ width, height: 900 });
        await page.goto(c.base);
        const base = await tableBox(page);
        test.skip(!base, `${c.name}: trạng thái gốc không có dòng`);
        for (const s of c.states) {
          await page.goto(s);
          await expectSameBox(page, base!, `${c.name} · ${s} @${width}`);
        }
      });
    }

    // Báo cáo: tháng đang sửa có ô nhập Đề nghị, tháng cũ chỉ có số — hai tháng gần nhất có bảng phải cùng cột
    test(`Vòng8 Báo cáo ${width}px: đổi tháng không dời cột`, async ({ page }, info) => {
      test.skip(isMobile(info), '390 xếp bảng thành thẻ');
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/admin/reports');
      const base = await tableBox(page);
      test.skip(!base, 'Báo cáo: tháng mặc định không có món');
      const ym = new URL(page.url()).searchParams.get('ym');
      test.skip(!ym, 'Báo cáo: URL không ghi tháng');
      const [y, m] = ym!.split('-').map(Number);
      const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
      await page.goto(`/admin/reports?ym=${prev}`);
      await expectSameBox(page, base!, `Báo cáo ${ym} → ${prev} @${width}`);
    });
  }
});

// Lịch sử của nhân viên: tháng có ghi chú dài (từ chối, đã hủy) và tháng chỉ có số phải cùng cột (bảng tự co từng lệch 83px)
test('Vòng8 Lịch sử: đổi tháng không dời cột bảng chi tiết', async ({ page, request }, info) => {
  test.skip(isMobile(info), '390 bảng chi tiết xếp thẻ');
  await skipNewPeriodPopup(page);
  const sub = `pw-tl-${Date.now()}-${info.project.name}`;
  seedActiveUser(sub, `PW Bảng lịch sử ${info.project.name}`);
  await page.route('**/api/**', (route) => route.continue({ headers: { ...route.request().headers(), 'x-dev-user-sub': sub, 'x-dev-role': 'member' } }));
  const [a, b] = [await seedPwItem(page), await seedPwItem(page)];
  // Kỳ quá khứ riêng của spec này (không trùng kỳ của spec khác)
  const [ymA, ymB] = ['2000-07', '2000-08'];
  const release = await acquireLock('table-layout-history');
  const created = psql(`INSERT INTO periods (ym, deadline) VALUES ('${ymA}-01', '${ymA}-10T17:00:00Z'), ('${ymB}-01', '${ymB}-10T17:00:00Z') ON CONFLICT DO NOTHING RETURNING ym`);
  psql(`WITH r AS (INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ('${ymA}-01', '${sub}', '${sub}') RETURNING id)
    INSERT INTO request_lines (request_id, item_id, qty, delivered_qty, cancelled_qty) SELECT r.id, x.item::uuid, x.qty, x.qty, 0 FROM r, (VALUES ('${a.id}', 1), ('${b.id}', 2)) AS x(item, qty)`);
  psql(`WITH r AS (INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ('${ymB}-01', '${sub}', '${sub}') RETURNING id),
    m AS (INSERT INTO request_lines (request_id, item_id, qty, delivered_qty, cancelled_qty) SELECT r.id, '${a.id}'::uuid, 12, 5, 1 FROM r)
    INSERT INTO request_lines (request_id, custom_name, custom_unit, qty, review_status, review_note)
    SELECT r.id, 'PW Bìa còng lưng rất dài cho cột Món', 'cai', 3, 'rejected', 'Đã có trong kho, nhận ở quầy Adm D&E' FROM r`);
  try {
    for (const width of [1440, 1280, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/history/${ymA}`);
      await expect(page.locator('.hs-table')).toBeVisible();
      const base = await tableBox(page, '.hs-table');
      expect(base, `${width}px tháng ${ymA} có bảng`).not.toBeNull();
      await page.goto(`/history/${ymB}`);
      await expect(page.locator('.hs-table')).toBeVisible();
      await expectSameBox(page, base!, `Lịch sử ${ymA} → ${ymB} @${width}`, '.hs-table');
      // 1024: tiêu đề cột số không gãy dòng (bảng bị bóp từng làm cả 5 tiêu đề xuống hai dòng)
      const wrapped = await page.locator('.hs-table thead th').evaluateAll((ths) => ths.filter((th) => th.getBoundingClientRect().height > 48).map((th) => th.textContent));
      expect(wrapped, `${width}px tiêu đề gãy dòng`).toEqual([]);
    }
  } finally {
    deleteTestUsers(sub);
    for (const it of [a, b]) await removeTestItem(request, it.id);
    if (created) psql(`DELETE FROM periods WHERE ym IN ('${ymA}-01', '${ymB}-01') AND NOT EXISTS (SELECT 1 FROM requests WHERE period_ym = periods.ym)`);
    release();
  }
});
