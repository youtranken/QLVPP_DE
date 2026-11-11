import { expect, test, type Page } from '@playwright/test';
import { asRole, isMobile } from './helpers';

// Bảng có tab/chip/ô lọc: đổi lọc không được làm cột nhảy chỗ (lỗi Danh bạ vòng 6 lọt review vì không ai đo).
// Đo x của từng tiêu đề cột ở trạng thái gốc rồi so với mọi trạng thái lọc; chỉ desktop (390 bảng xếp thẻ)
asRole('admin');

async function headerXs(page: Page): Promise<number[]> {
  const table = page.getByRole('table').first();
  await expect(table).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  return table.locator(':scope > thead > tr').first().locator('th').evaluateAll((ths) => ths.map((th) => Math.round(th.getBoundingClientRect().left)));
}

interface Case {
  name: string;
  base: string;
  // Trạng thái lọc: URL (tab/chip ghi vào URL) hoặc thao tác trên trang
  states: (string | ((page: Page) => Promise<void>))[];
}

const CASES: Case[] = [
  { name: 'Danh bạ', base: '/admin/users', states: ['/admin/users?status=active', '/admin/users?reg=no', '/admin/users?status=locked', '/admin/users?status=no_access'] },
  { name: 'Tủ / Kho', base: '/admin/stock', states: ['/admin/stock?filter=incoming', '/admin/stock?filter=low', '/admin/stock?filter=none'] },
  { name: 'Sản phẩm', base: '/admin/catalog?view=table', states: ['/admin/catalog?view=table&tab=active', '/admin/catalog?view=table&tab=inactive', '/admin/catalog?view=table&tab=noImage'] },
  { name: 'Nhật ký', base: '/admin/audit', states: ['/admin/audit?action=auth.login_denied_idp', '/admin/audit?action=stock.receipt'] },
  {
    name: 'Danh mục',
    base: '/admin/categories',
    states: [async (page) => page.getByRole('searchbox', { name: /^Tìm nhóm/ }).fill('but')],
  },
];

for (const c of CASES) {
  test(`Vòng6 ${c.name}: cột đứng yên khi đổi lọc`, async ({ page }, info) => {
    test.skip(isMobile(info), '390 xếp bảng thành thẻ');
    await page.goto(c.base);
    const base = await headerXs(page);
    for (const s of c.states) {
      if (typeof s === 'string') await page.goto(s);
      else await s(page);
      const xs = await headerXs(page);
      // Trạng thái không có dòng nào vẫn có tiêu đề cột; nếu bảng ẩn tiêu đề (rỗng) thì bỏ qua trạng thái đó
      if (xs.length === 0) continue;
      expect(xs, `${c.name} · ${typeof s === 'string' ? s : 'lọc trên trang'}`).toEqual(base);
    }
  });
}
