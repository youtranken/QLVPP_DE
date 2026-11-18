import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { asRole, expectNoContrastViolations, isMobile, monthRowAction, psql, removeTestItem, seedPwItem } from './helpers';

// Dữ liệu giả cho trang chỉ đọc: không tra người/phiếu/dòng có sẵn của DB dev chung
const PW_PERSON_LINE = {
  line_id: 'pw-line-p1',
  request_id: 'pw-req-p1',
  period_ym: '2000-01',
  is_debt: false,
  item_id: null,
  name: 'PW món giao',
  name_en: null,
  unit: 'cai',
  image_file_id: null,
  qty: 2,
  delivered_qty: 0,
  cancelled_qty: 0,
  remaining_qty: 2,
  stock_qty: null,
  review_status: 'accepted',
  adm_out: false,
  deliver_cap: 2,
  request_at: '2000-01-05T07:20:00.000Z',
  line_at: '2000-01-05T07:20:00.000Z',
  sort_order: null,
  category: null,
};
// Người còn dòng tháng đang giao: thẻ nằm ở tab mặc định "Chưa nhận"
const PW_PERSON = {
  user_sub: 'pw-panel-a',
  full_name: 'PW Panel An',
  department: null,
  user_status: 'active',
  request_id: 'pw-req-p1',
  status: 'pending',
  owed_lines: 0,
  open_lines: 1,
  has_pending: true,
  has_debt: false,
  deliverable_now: true,
  lines: [PW_PERSON_LINE],
};
const PW_USER = { sub: 'pw-panel-user', fullName: 'PW Panel Người', email: 'pw-panel@example.test', department: 'PW Phòng', status: 'active', employeeCode: null, team: null, role: 'member', lastLoginAt: null };
const PW_LINE = {
  line_id: 'pw-line-1',
  request_id: 'pw-req-1',
  period_ym: '2000-01',
  user_sub: 'pw-panel-a',
  full_name: 'PW Panel An',
  department: null,
  user_status: 'active',
  item_id: null,
  name: 'PW món nợ',
  name_en: null,
  unit: 'cai',
  qty: 3,
  delivered_qty: 1,
  cancelled_qty: 0,
  remaining_qty: 2,
  stock_qty: null,
  counted_in_snapshot_qty: null,
};
const PW_SUMMARY = {
  deadline: '2000-01-10T17:00:00.000Z',
  is_open: false,
  registered: 1,
  headcount: 1,
  headcount_source: 'snapshot',
  unregistered: 0,
  outside: 0,
  lines_pending_delivery: 0,
  custom_pending: 0,
  low_stock: 0,
  receipts: 0,
};
const PW_ROW = {
  request_id: 'pw-req-1',
  user_sub: 'pw-panel-a',
  full_name: 'PW Panel An',
  email: null,
  department: null,
  user_status: 'active',
  line_count: 1,
  total_qty: 3,
  delivered_qty: 0,
  cancelled_qty: 0,
  custom_pending: 0,
  over_max: false,
  short_items: [],
  updated_at: '2000-01-05T07:20:00.000Z',
  saved_at: '2000-01-05T07:20:00.000Z',
};

async function mockDelivery(page: Page) {
  await page.route('**/api/admin/periods/*/delivery-people', (route) => route.fulfill({ status: 200, json: { ym: '2000-01', people: [PW_PERSON] } }));
}

async function mockUsers(page: Page) {
  await page.route('**/api/admin/users?*', (route) => route.fulfill({ status: 200, json: { items: [PW_USER], next_cursor: null } }));
}

async function mockBacklog(page: Page) {
  const group = { key: 'custom:PW món nợ', label: { item_id: null, name: PW_LINE.name, unit: 'cai' }, remaining_qty: 2, lines: [PW_LINE] };
  await page.route('**/api/admin/backlog?*', (route) => route.fulfill({ status: 200, json: { groups: [group] } }));
  await page.route('**/api/admin/lines/pw-line-1/deliveries', (route) =>
    route.fulfill({ status: 200, json: { line: { id: PW_LINE.line_id, qty: 3, delivered_qty: 1, cancelled_qty: 0, cancel_note: null }, items: [] } }),
  );
}

async function mockSummary(page: Page) {
  await page.route(/\/api\/admin\/periods\/\d{4}-\d{2}\/summary$/, (route) => {
    const ym = /periods\/(\d{4}-\d{2})\//.exec(route.request().url())![1];
    return route.fulfill({ status: 200, json: { ...PW_SUMMARY, ym } });
  });
  await page.route(/\/api\/admin\/periods\/\d{4}-\d{2}\/requests\?/, (route) => route.fulfill({ status: 200, json: { items: [PW_ROW], next_cursor: null } }));
  await page.route('**/api/admin/requests/pw-req-1', (route) => route.fulfill({ status: 404, json: { code: 'NOT_FOUND', message: 'x' } }));
}

// AC #2/#3: mở panel → lưới phía sau không đổi chỗ/bề rộng; panel nằm trên; nền mờ phủ cả sidebar; 390 rộng hết + "← Đóng"
async function expectOverlay(page: Page, info: TestInfo, behind: Locator, open: () => Promise<void>, panel: Locator, param: string) {
  await expect(behind).toBeVisible();
  // Font web (display=swap) về muộn làm hàng chip xuống dòng khác → chốt bố cục trước khi đo
  await page.evaluate(() => document.fonts.ready);
  // Panel là hộp thoại modal: phần nền bị aria-hidden nên locator theo vai không còn thấy lưới — giữ handle DOM từ trước
  // Toạ độ theo trang (cộng scroll): bấm nút ở 390 có thể cuộn trang tới nút, không phải lưới bị đẩy
  const grid = (await behind.elementHandle())!;
  const pageBox = () =>
    grid.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height };
    });
  const before = await pageBox();
  await open();
  await expect(panel).toBeVisible();
  expect(new URL(page.url()).searchParams.has(param), `?${param}= trên URL`).toBe(true);
  expect(await pageBox(), 'lưới không bị đẩy/co').toEqual(before);
  if (isMobile(info)) {
    // × ở đầu panel (chân panel có thể có thêm nút chữ "Đóng")
    await expect(panel.getByRole('button', { name: 'Đóng' }).first()).toBeVisible();
    expect(Math.round((await panel.boundingBox())!.width)).toBe(390);
    const scroll = await page.evaluate(() => document.scrollingElement!.scrollWidth - document.documentElement.clientWidth);
    expect(scroll, 'không cuộn ngang').toBeLessThanOrEqual(0);
    await expectNoContrastViolations(page);
  } else {
    expect(Math.round((await panel.boundingBox())!.width)).toBe(440);
    const onScrim = await page.evaluate(() => {
      const hit = document.elementFromPoint(10, 10)!;
      return getComputedStyle(hit).position === 'fixed' && !hit.closest('nav, main, [role="dialog"]');
    });
    expect(onScrim, 'điểm (10,10) thuộc nền mờ, không phải sidebar').toBe(true);
  }
  await page.goBack();
  await expect(panel).toBeHidden();
  expect(new URL(page.url()).searchParams.has(param)).toBe(false);
}

test.describe('V2D-17b panel phủ ở Giao hàng, Tổng hợp, Tủ / Kho, Nhân viên, Còn nợ', () => {
  asRole('admin');

  test('V2D-17b Giao hàng: ⋯ → "Xem chi tiết" mở panel người ở mọi bề rộng, không còn cột bên', async ({ page }, info) => {
    await mockDelivery(page);
    await page.goto('/admin/delivery');
    const grid = page.getByRole('table').first();
    await expectOverlay(page, info, grid, async () => {
      await grid.getByRole('button', { name: `Thao tác cho ${PW_PERSON.full_name}` }).click();
      await page.getByRole('menuitem', { name: 'Xem chi tiết' }).click();
    }, page.getByRole('dialog', { name: PW_PERSON.full_name }), 'person');
  });

  test('V2D-17b Tổng hợp: bấm người mở panel điều chỉnh phiếu', async ({ page }, info) => {
    await mockSummary(page);
    // Không ym thì trang mở kỳ đang giao (hoặc kỳ đăng ký khi kỳ giao rỗng) — ghim kỳ khóa giả để mock khớp
    await page.goto('/admin/month?ym=2000-01');
    const table = page.getByRole('table').first();
    await expectOverlay(page, info, table, () => monthRowAction(page, PW_ROW.full_name!, 'Điều chỉnh phiếu'), page.getByRole('dialog', { name: 'Điều chỉnh phiếu' }), 'request');
  });

  test('V2D-17b Nhân viên: bấm tên mở panel người', async ({ page }, info) => {
    await mockUsers(page);
    await page.goto('/admin/users');
    const table = page.getByRole('table').first();
    await expectOverlay(page, info, table, () => page.getByRole('button', { name: PW_USER.fullName, exact: true }).click(), page.getByRole('dialog', { name: 'Người dùng' }), 'person');
  });

  test('V2D-17b Còn nợ: "Lịch sử giao" mở panel lịch sử một dòng', async ({ page }, info) => {
    await mockBacklog(page);
    await page.goto('/admin/backlog');
    const table = page.getByRole('table').first();
    const open = async () => {
      if (isMobile(info)) {
        await page.getByRole('button', { name: `Thao tác khác ${PW_LINE.name} — ${PW_LINE.full_name}` }).click();
        await page.getByRole('menuitem', { name: 'Lịch sử giao' }).click();
      } else {
        await page.getByRole('button', { name: `Lịch sử giao ${PW_LINE.name} — ${PW_LINE.full_name}` }).click();
      }
    };
    await expectOverlay(page, info, table, open, page.getByRole('dialog', { name: `Lịch sử giao ${PW_LINE.full_name}` }), 'line');
  });

  test('V2D-17b Tủ / Kho: tên món mở panel lịch sử nhập xuất; F5 với ?item= mở lại đúng món', async ({ page }, info) => {
    const item = await seedPwItem(page, { stock: 3 });
    try {
      await page.goto(`/admin/stock?q=${encodeURIComponent(item.name)}`);
      const table = page.getByRole('table').first();
      const ledger = page.getByRole('dialog', { name: `Lịch sử nhập xuất ${item.name}` });
      await expectOverlay(page, info, table, () => page.getByRole('button', { name: `Xem lịch sử nhập xuất ${item.name}` }).click(), ledger, 'item');
      await page.goto(`/admin/stock?item=${item.id}`);
      await expect(ledger).toBeVisible();
    } finally {
      await removeTestItem(page.request, item.id);
    }
  });
});

test.describe('Tủ / Kho theo bản Sau (AD-35…37)', () => {
  asRole('admin');

  test('AD-35/36: không nút "Sản phẩm" đầu trang; mức 10 trống 2 → "Sắp hết", trống 3 → "—"', async ({ page }) => {
    const low = await seedPwItem(page, { stock: 2 });
    const ok = await seedPwItem(page, { stock: 3 });
    try {
      psql(`UPDATE items SET restock_level = 10 WHERE id IN ('${low.id}', '${ok.id}')`);
      await page.goto(`/admin/stock?q=${encodeURIComponent('PW món')}`);
      await expect(page.getByRole('heading', { level: 1, name: 'Tủ / Kho' })).toBeVisible();
      await expect(page.getByRole('main').getByRole('link', { name: 'Sản phẩm' })).toHaveCount(0);
      await expect(page.getByRole('row').filter({ hasText: low.name }).getByText('Sắp hết')).toBeVisible();
      await expect(page.getByRole('row').filter({ hasText: ok.name }).getByText('Sắp hết')).toHaveCount(0);
      await expect(page.getByText(/^Đang hiện \d+\/\d+ món$/)).toHaveCount(0);
    } finally {
      await removeTestItem(page.request, low.id);
      await removeTestItem(page.request, ok.id);
    }
  });
});

// Rà soát 13/11 #2: mở bằng Enter, đóng bằng Esc → focus về đúng nút mở (trước đây rơi về BODY ở 3 hộp này)
test.describe('Đóng panel/hộp trả focus về nút mở', () => {
  asRole('admin');

  async function enterThenEsc(page: Page, opener: Locator, dialog: Locator) {
    await expect(opener).toBeEnabled();
    await opener.focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  }

  test('Kỳ tháng: Điều chỉnh phiếu', async ({ page }) => {
    await mockSummary(page);
    await page.goto('/admin/month?ym=2000-01');
    // ⋯ → Enter mở menu (focus mục đầu) → ↓ "Điều chỉnh phiếu" → Enter; Esc đóng hộp, focus về ⋯
    const more = page.getByRole('button', { name: `Thao tác cho ${PW_ROW.full_name}` });
    await more.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Điều chỉnh phiếu' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(more).toBeFocused();
  });

  test('Tủ / Kho: Lịch sử nhập xuất; nút đầu trang Xuất lẻ một món', async ({ page }) => {
    const item = await seedPwItem(page, { stock: 3 });
    try {
      await page.goto(`/admin/stock?q=${encodeURIComponent(item.name)}`);
      await enterThenEsc(page, page.getByRole('button', { name: `Xem lịch sử nhập xuất ${item.name}` }), page.getByRole('dialog', { name: `Lịch sử nhập xuất ${item.name}` }));
      await page.goto('/admin/stock');
      await enterThenEsc(page, page.getByRole('button', { name: 'Xuất lẻ một món' }), page.getByRole('dialog', { name: /^Xuất lẻ/ }));
    } finally {
      await removeTestItem(page.request, item.id);
    }
  });
});
