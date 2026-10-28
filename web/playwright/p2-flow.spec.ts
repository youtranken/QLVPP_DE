import { mkdirSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Browser, type Page, type TestInfo } from '@playwright/test';
import { deleteTestUsers, devHeaders, expectNoContrastViolations, isMobile, psql, removeTestItem } from './helpers';

const SHOTS = '../.superpowers/sdd/2026-10-28-vpp-gd1-p2-phieu-tong-hop/task-17-shots';
const FIXTURE = 'playwright/fixtures/item.png';
const SA_USERNAME = process.env.PW_SA_USERNAME ?? 'sa';
const SA_PASSWORD = process.env.PW_SA_PASSWORD;

type Person = { sub: string; name: string };
type Item = { id: string; name: string; active: boolean; admin_only: boolean };

async function snap(page: Page, info: TestInfo, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all(document.getAnimations().map((x) => x.finished)));
  await page.screenshot({ path: `${SHOTS}/${name}-${info.project.name}.png` });
}

const memberHeaders = (sub: string) => ({ 'x-dev-user-sub': sub, 'x-dev-role': 'member' });

async function newPage(browser: Browser, info: TestInfo, headers?: Record<string, string>) {
  const { viewport, hasTouch, isMobile: mobile, baseURL } = info.project.use;
  const ctx = await browser.newContext({ baseURL, viewport, hasTouch, isMobile: mobile });
  const page = await ctx.newPage();
  if (headers) await page.route('**/api/**', (route) => route.continue({ headers: { ...route.request().headers(), ...headers } }));
  return page;
}

// SA thật khi có mật khẩu (SA giới hạn 10 lần/phút/IP: mỗi viewport đăng nhập đúng một lần); không thì dev admin
async function adminPage(browser: Browser, info: TestInfo) {
  const page = await newPage(browser, info, SA_PASSWORD ? undefined : devHeaders('admin'));
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  if (!SA_PASSWORD) return page;
  await page.goto('/');
  await page.getByRole('button', { name: 'Dành cho IT' }).click();
  await page.getByLabel('Tên tài khoản').fill(SA_USERNAME);
  await page.getByLabel('Mật khẩu').fill(SA_PASSWORD);
  const login = page.waitForResponse((r) => r.url().endsWith('/api/auth/sa-login'));
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  expect((await login).status()).toBe(200);
  return page;
}

async function memberRegisters(page: Page, info: TestInfo, items: Item[], custom: string) {
  await page.goto('/');
  const grid = page.getByRole('region', { name: 'Danh mục món' });
  for (const item of items) await grid.getByRole('button', { name: `Thêm ${item.name}`, exact: true }).click();
  await grid.getByRole('button', { name: '+ Thêm món khác' }).click();
  const dialog = page.getByRole('dialog', { name: 'Thêm món khác' });
  await dialog.getByLabel('Tên món').fill(custom);
  await dialog.getByLabel('Đơn vị tính').selectOption('cai');
  await dialog.getByLabel('Chụp hoặc chọn ảnh').setInputFiles(FIXTURE);
  await expect(dialog.getByRole('img', { name: 'Ảnh món' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Thêm vào phiếu' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: '3 thay đổi chưa lưu · Lưu' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lưu phiếu' }).click();
  await expect(page.getByText(/^Đã lưu \d{2}:\d{2}/)).toBeVisible();
  await snap(page, info, 'member-a-saved');
}

async function openDrawer(admin: Page, tag: string, person: Person) {
  await admin.getByRole('searchbox', { name: 'Tìm người, email…' }).fill(tag);
  await admin.getByRole('row').filter({ hasText: person.name }).getByRole('button', { name: 'Điều chỉnh' }).click();
  const drawer = admin.getByRole('dialog', { name: `Phiếu của ${person.name}` });
  await expect(drawer.getByText('Đang mở', { exact: true })).toBeVisible();
  return drawer;
}

async function adminAdjusts(admin: Page, info: TestInfo, tag: string, a: Person, custom: string) {
  let drawer = await openDrawer(admin, tag, a);
  await drawer.getByRole('button', { name: '+ Thêm món vào phiếu' }).click();
  await drawer.getByRole('searchbox', { name: 'Tìm món trong danh mục' }).fill('Giấy A4');
  await drawer.getByRole('list', { name: 'Món tìm thấy' }).getByRole('button').first().click();
  await expect(drawer.getByRole('listitem').filter({ hasText: 'Giấy A4' }).getByRole('spinbutton')).toHaveValue('1');
  await snap(admin, info, 'admin-adjust');
  await drawer.getByRole('button', { name: 'Lưu điều chỉnh' }).click();
  await expect(drawer).toBeHidden();

  drawer = await openDrawer(admin, tag, a);
  await drawer.getByRole('group', { name: `Xử lý ${custom}` }).getByRole('button', { name: `Thêm vào danh mục… — ${custom}` }).click();
  const convert = admin.getByRole('dialog', { name: `Thêm “${custom}” vào danh mục` });
  await convert.getByLabel('Nhóm').selectOption({ index: 1 });
  await convert.getByRole('button', { name: 'Thêm vào danh mục', exact: true }).click();
  await expect(convert).toBeHidden();
  await expect(drawer.getByText('Đã thêm vào danh mục')).toBeVisible();
  await snap(admin, info, 'admin-converted');
  await admin.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
}

async function summaryKpi(request: APIRequestContext, ym: string) {
  const res = await request.get(`/api/admin/periods/${ym}/summary`, { headers: devHeaders('admin') });
  expect(res.status()).toBe(200);
  return (await res.json()) as { registered: number; headcount: number };
}

test.describe('Smoke Plan 2 toàn luồng', () => {
  test('Plan 2: A đăng ký 2 món + 1 món ngoài DM có ảnh, B lưu 1 món → Hành chính Tổng hợp, sao chép chưa đăng ký có C, thêm Giấy A4 vào phiếu A, Thêm vào danh mục → A thấy "Hành chính thêm" chỉ đọc, "Đã thêm vào danh mục", Lịch sử có kỳ hiện tại', async ({
    page,
    browser,
    request,
  }, info) => {
    const tag = `${Date.now().toString(36)}${isMobile(info) ? 'm' : 'd'}`;
    const dept = `PW Phòng P2 ${tag}`;
    const [a, b, c]: Person[] = ['a', 'b', 'c'].map((k) => ({ sub: `pw-p2-${k}-${tag}`, name: `PW P2 ${k.toUpperCase()} ${tag}` }));
    const custom = `PW kẹp giấy P2 ${tag}`;
    psql(`INSERT INTO users (sub, full_name, email, department, status) VALUES
      ${[a, b, c].map((p) => `('${p.sub}', '${p.name}', '${p.sub}@example.test', '${dept}', 'active')`).join(',\n')}`);
    try {
      const period = await (await request.get('/api/periods/current', { headers: memberHeaders(a.sub) })).json();
      const month = Number(String(period.ym).slice(5));
      const items: Item[] = await (await request.get('/api/items', { headers: memberHeaders(a.sub) })).json();
      const [x, y] = items.filter((i) => i.active && !i.admin_only && !i.name.startsWith('PW '));
      const before = await summaryKpi(request, period.ym);

      await page.route('**/api/**', (route) => route.continue({ headers: { ...route.request().headers(), ...memberHeaders(a.sub) } }));
      await memberRegisters(page, info, [x, y], custom);
      const savedB = await request.put('/api/me/request/lines', {
        headers: memberHeaders(b.sub),
        data: { ym: period.ym, lines: [{ item_id: x.id, qty: 1 }] },
      });
      expect(savedB.status()).toBe(200);

      const admin = await adminPage(browser, info);
      await admin.goto('/admin/summary');
      await expect(admin.getByRole('heading', { level: 1, name: 'Tổng hợp kỳ' })).toBeVisible();
      await expect(admin.getByRole('button', { name: /Phiếu đã đăng ký/ })).toContainText(`${before.registered + 2}/${before.headcount}`);
      await admin.getByRole('button', { name: /Sao chép danh sách chưa đăng ký/ }).click();
      await expect(admin.getByText(/^Đã sao chép \d+ người$/)).toBeVisible();
      const copied = await admin.evaluate(() => navigator.clipboard.readText());
      expect(copied.split('\n')).toContain(`- ${c.name} — ${dept}`);
      expect(copied).not.toContain(a.name);
      if (isMobile(info)) await expectNoContrastViolations(admin);
      await snap(admin, info, 'admin-summary');
      await adminAdjusts(admin, info, tag, a, custom);
      await admin.context().close();

      await page.reload();
      const cart = page.getByRole('complementary', { name: 'Phiếu của tôi' });
      const added = cart.locator('li', { hasText: 'Giấy A4' });
      await expect(added.getByText('Hành chính thêm')).toBeVisible();
      await expect(added.getByRole('button')).toHaveCount(0);
      await expect(added.getByRole('spinbutton')).toHaveCount(0);
      await expect(cart.locator('li', { hasText: custom }).getByText('Đã thêm vào danh mục')).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'member-a-after');

      const nav = page.getByRole('navigation', { name: isMobile(info) ? 'Điều hướng chính' : 'Chuyển trang' });
      await nav.getByRole('link', { name: 'Lịch sử' }).click();
      const current = page.getByRole('link', { name: new RegExp(`Tháng ${month}/`) });
      await expect(current.getByText('Đang mở')).toBeVisible();
      await snap(page, info, 'member-a-history');
    } finally {
      deleteTestUsers(a.sub, b.sub, c.sub);
      const all: Item[] = await (await request.get('/api/admin/items', { headers: devHeaders('admin') })).json();
      const converted = all.find((i) => i.name === custom);
      if (converted) await removeTestItem(request, converted.id);
    }
  });
});
