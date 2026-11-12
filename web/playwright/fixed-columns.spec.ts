import { expect, test, type Page } from '@playwright/test';
import { acquireLock, asRole, devHeaders, isMobile, pendingConfirm } from './helpers';
import { seedLockedRequest } from './locked-request';
import { PRIVATE_YM, clearPrivateSnapshots, openOnPrivatePeriod } from './private-period';

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
    expect(base.some((x) => x > 0), `${c.name}: trạng thái gốc phải có dòng`).toBe(true);
    for (const s of c.states) {
      if (typeof s === 'string') await page.goto(s);
      else await s(page);
      const xs = await headerXs(page);
      // Lọc ra rỗng thì bảng ẩn đầu cột (x đều 0): không có gì để so, bỏ qua trạng thái đó
      if (xs.every((x) => x === 0)) continue;
      expect(xs, `${c.name} · ${typeof s === 'string' ? s : 'lọc trên trang'}`).toEqual(base);
    }
  });
}

// Màn vừa 768–1024: cột hẹp không được đẩy tiêu đề hay nút tràn sang cột bên (bảng hẹp hơn tổng tối thiểu thì cuộn ngang)
for (const width of [768, 1024]) {
  for (const c of CASES) {
    test(`Vòng6 ${c.name} ${width}px: tiêu đề và nút nằm trong cột`, async ({ page }, info) => {
      test.skip(isMobile(info), '390 xếp bảng thành thẻ');
      await page.setViewportSize({ width, height: 900 });
      await page.goto(c.base);
      await headerXs(page);
      const spills = await page
        .getByRole('table')
        .first()
        .evaluate((table) => {
          const out: string[] = [];
          const rows = [table.querySelector('thead tr'), ...table.querySelectorAll('tbody tr')].filter(Boolean).slice(0, 8) as HTMLTableRowElement[];
          for (const tr of rows) {
            for (const cell of tr.cells) {
              const box = cell.getBoundingClientRect();
              if (box.width === 0) continue;
              for (const el of cell.querySelectorAll('button, input, a, .tag, span, b')) {
                const r = el.getBoundingClientRect();
                if (r.width === 0 || el.closest('.sr-only')) continue;
                if (r.right > box.right + 1 || r.left < box.left - 1) out.push(`${cell.tagName} "${(cell.textContent ?? '').trim().slice(0, 30)}" ⊃ ${el.tagName} ${Math.round(r.left)}–${Math.round(r.right)} ngoài ${Math.round(box.left)}–${Math.round(box.right)}`);
              }
              if (cell.tagName === 'TH' && cell.scrollWidth > cell.clientWidth + 1) out.push(`TH "${cell.textContent}" tràn ${cell.scrollWidth}>${cell.clientWidth}`);
            }
          }
          return out;
        });
      expect(spills).toEqual([]);
    });
  }
}

// Nhận hàng: gõ thiếu (chữ "Nhập/NCC còn nợ", số Còn thiếu), nút nhóm đổi "Nhận đủ hàng" ↔ "Nhận hàng" — cột không được nhảy.
// Kỳ riêng của PW với bản gửi NCC thật; không bấm "NCC hết hàng" vì nút đó ghi xuống server
test('Vòng7 Nhận hàng: cột đứng yên khi gõ thiếu/đủ và khi nút nhóm đổi chữ', async ({ page, request }, info) => {
  test.skip(isMobile(info), '390 xếp bảng thành thẻ');
  const release = await acquireLock('prev-period');
  clearPrivateSnapshots();
  const seed = await seedLockedRequest(request, info, [{ stock: 0, qty: 5 }, { stock: 0, qty: 3 }], { ym: PRIVATE_YM });
  const [a] = seed.items;
  try {
    const made = await request.post(`/api/admin/reports/${PRIVATE_YM}/snapshots`, { headers: devHeaders('admin'), data: { kind: 'print', ...(await pendingConfirm(request, PRIVATE_YM)) } });
    expect(made.status()).toBe(201);
    await openOnPrivatePeriod(page);
    for (const width of [1280, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/admin/arrivals?q=${encodeURIComponent(seed.tag)}`);
      const table = page.getByRole('table', { name: 'Hàng về theo món' });
      await expect(table).toBeVisible();
      const xs = () => table.locator(':scope > thead > tr').first().locator('th').evaluateAll((ths) => ths.map((th) => Math.round(th.getBoundingClientRect().left)));
      const box = page.getByRole('spinbutton', { name: `Nhận đợt này: ${a.name}` });
      await expect(box).toHaveValue('5');
      const base = await xs();
      expect(base).toHaveLength(7);
      await box.fill('2');
      await expect(page.getByText('NCC còn nợ: 3', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Nhận hàng: / })).toBeVisible();
      expect(await xs(), `${width}px gõ thiếu`).toEqual(base);
      await box.fill('5');
      await expect(page.getByRole('button', { name: /^Nhận đủ hàng: / })).toBeVisible();
      expect(await xs(), `${width}px gõ đủ lại`).toEqual(base);
    }
  } finally {
    clearPrivateSnapshots();
    seed.cleanup();
    release();
  }
});
