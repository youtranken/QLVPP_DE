import { expect, test, type Page } from '@playwright/test';
import { devHeaders, isMobile, skipNewPeriodPopup } from './helpers';

// Mục 3 rà soát: lệch riêng từng màn — mã không bẻ giữa, tiêu đề cột một dòng, nút cùng cột, cột Người không gãy. Chỉ đọc.
async function as(page: Page) {
  await skipNewPeriodPopup(page);
  await page.route('**/api/**', (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.abort();
    return route.continue({ headers: { ...req.headers(), ...devHeaders('admin') } });
  });
}
async function go(page: Page, path: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}
// Số dòng chữ thật (không tính đệm ô): đếm đỉnh khác nhau của các hộp chữ
const lines = (el: Element) => {
  const r = document.createRange();
  r.selectNodeContents(el);
  return new Set([...r.getClientRects()].filter((b) => b.width > 0).map((b) => Math.round(b.top))).size;
};

test.describe('Lệch riêng từng màn (Task 20)', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(isMobile(info), 'đo ở máy tính');
    await as(page);
  });

  test('Sản phẩm 1280: mã một dòng (dài thì "…" + title), tiêu đề "Tối đa/tháng" một dòng', async ({ page }) => {
    await go(page, '/admin/catalog?view=table', 1280);
    const out = await page.evaluate(`(() => {
      const lines = ${lines.toString()};
      const codes = [...document.querySelectorAll('main .ct-code__text')].filter((el) => lines(el) > 1).map((el) => el.textContent);
      const th = [...document.querySelectorAll('main th')].find((h) => h.textContent.includes('Tối đa'));
      return { codes, header: th ? lines(th) : 0 };
    })()`);
    expect(out).toEqual({ codes: [], header: 1 });
  });

  test('Danh bạ 1024: mã NV không bị cắt', async ({ page }) => {
    await go(page, '/admin/users', 1024);
    const clipped = await page.evaluate(() => [...document.querySelectorAll('main tbody tr')].map((tr) => tr.children[1] as HTMLElement).filter((td) => td && td.scrollWidth > td.clientWidth + 1).map((td) => td.textContent));
    expect(clipped).toEqual([]);
  });

  test('Nhật ký 768: cột Người một dòng ("Hệ thống (tự động)" không gãy)', async ({ page }) => {
    await go(page, '/admin/audit', 768);
    const broken = await page.evaluate(`(() => {
      const lines = ${lines.toString()};
      return [...document.querySelectorAll('main .au-person__name')].filter((el) => lines(el) > 1).map((el) => el.textContent);
    })()`);
    expect(broken).toEqual([]);
  });

  test('Đơn vị tính 1280: nút "Sửa" cùng một cột ở mọi dòng', async ({ page }) => {
    await go(page, '/admin/units', 1280);
    const xs = await page.getByRole('button', { name: /^Sửa/ }).evaluateAll((els) => [...new Set(els.map((e) => Math.round(e.getBoundingClientRect().left)))]);
    expect(xs.length, `vị trí x: ${xs.join(', ')}`).toBe(1);
  });
});

test('Báo cáo 390: vẫn có nút ⓘ "Cách tính Tổng cần" (đầu bảng ẩn khi bảng thành thẻ)', async ({ page }, info) => {
  test.skip(!isMobile(info), 'đo ở điện thoại');
  await as(page);
  await page.goto('/admin/reports');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('button', { name: /Cách tính Tổng cần/ }).filter({ visible: true })).toHaveCount(1);
});
