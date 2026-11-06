import { mkdirSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import {
  acquireLock,
  copyUnregisteredList,
  deleteTestUsers,
  devHeaders,
  expectNoContrastViolations,
  isMobile,
  psql,
  removeTestItem,
  searchSummaryPeople,
  seedActiveUser,
  seedPwItem,
  settled,
} from './helpers';
import { adminPage } from './sessions';

const SHOTS = '../.superpowers/sdd/2026-10-28-vpp-gd1-p2-phieu-tong-hop/task-17-shots';
const FIXTURE = 'playwright/fixtures/item.png';

type Person = { sub: string; name: string };
type Item = { id: string; name: string };

async function snap(page: Page, info: TestInfo, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await settled(page);
  await page.screenshot({ path: `${SHOTS}/${name}-${info.project.name}.png` });
}

const memberHeaders = (sub: string) => ({ 'x-dev-user-sub': sub, 'x-dev-role': 'member' });

async function memberRegisters(page: Page, info: TestInfo, items: Item[], custom: string) {
  await page.goto('/');
  const grid = page.getByRole('region', { name: 'Danh mục món' });
  for (const item of items) {
    await grid.getByRole('searchbox', { name: 'Tìm món' }).fill(item.name);
    await grid.getByRole('button', { name: `Thêm vào phiếu: ${item.name}`, exact: true }).click();
  }
  await grid.getByRole('button', { name: '+ Thêm món khác' }).click();
  const dialog = page.getByRole('dialog', { name: 'Thêm món khác' });
  await dialog.getByLabel('Tên món').fill(custom);
  await dialog.getByLabel('Đơn vị tính').selectOption('cai');
  await dialog.getByRole('button', { name: 'Thêm vào phiếu' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: isMobile(info) ? 'Lưu phiếu' : '3 thay đổi chưa lưu · Lưu' }).click();
  await page.getByRole('dialog', { name: /^Lưu phiếu tháng/ }).getByRole('button', { name: 'Lưu phiếu' }).click();
  await expect(page.getByText(/^Đã lưu \d{2}:\d{2}/)).toBeVisible();
  await snap(page, info, 'member-a-saved');
}

async function openDrawer(admin: Page, person: Person) {
  await admin.getByRole('row').filter({ hasText: person.name }).getByRole('button', { name: 'Điều chỉnh' }).click();
  const drawer = admin.getByRole('dialog', { name: `Phiếu của ${person.name}` });
  await expect(drawer.getByText('Đã khóa', { exact: true })).toBeVisible();
  return drawer;
}

// Kỳ khóa Hành chính chỉ giảm/bỏ: bỏ món y khỏi phiếu A, có lý do
async function adminAdjusts(admin: Page, info: TestInfo, tag: string, a: Person, custom: string, dropped: string) {
  await searchSummaryPeople(admin, tag);
  let drawer = await openDrawer(admin, a);
  await drawer.getByRole('button', { name: `Bỏ ${dropped} khỏi phiếu` }).click();
  await snap(admin, info, 'admin-adjust');
  // Lý do riêng từng dòng giảm
  await drawer.getByRole('listitem').filter({ hasText: dropped }).getByRole('radiogroup', { name: 'Vì sao giảm?' }).getByRole('radio', { name: 'Trùng với phiếu khác' }).check();
  await drawer.getByRole('button', { name: 'Lưu điều chỉnh' }).click();
  await expect(drawer).toBeHidden();

  drawer = await openDrawer(admin, a);
  await drawer.getByRole('group', { name: `Xử lý ${custom}` }).getByRole('button', { name: `Mua và thêm vào danh mục — ${custom}` }).click();
  const convert = admin.getByRole('dialog', { name: `Mua “${custom}” và thêm vào danh mục` });
  await convert.getByRole('radiogroup', { name: 'Nhóm' }).getByRole('radio').first().click();
  // Dòng Món khác không có ảnh → món mới phải có ảnh mới chọn ở đây
  await convert.getByLabel('Chụp hoặc chọn ảnh').setInputFiles(FIXTURE);
  await expect(convert.getByRole('img', { name: 'Ảnh món' })).toBeVisible();
  await convert.getByRole('button', { name: 'Mua và thêm vào danh mục', exact: true }).click();
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
  test('Plan 2: A đăng ký 2 món + 1 món ngoài DM, B lưu 1 món → kỳ khóa → Hành chính Tổng hợp, sao chép chưa đăng ký có C, bỏ một món khỏi phiếu A có lý do, Thêm vào danh mục → A thấy ở Lịch sử kỳ đó món bị bỏ kèm lý do và "Đã thêm vào danh mục"', async ({
    page,
    browser,
    request,
  }, info) => {
    const tag = `${Date.now().toString(36)}${isMobile(info) ? 'm' : 'd'}`;
    const dept = `PW Phòng P2 ${tag}`;
    const [a, b, c]: Person[] = ['a', 'b', 'c'].map((k) => ({ sub: `pw-p2-${k}-${tag}`, name: `PW P2 ${k.toUpperCase()} ${tag}` }));
    const custom = `PW kẹp giấy P2 ${tag}`;
    // Dev DB có authorized_groups: người seed phải thuộc nhóm được dùng app mới vào danh sách chưa đăng ký
    for (const p of [a, b, c]) seedActiveUser(p.sub, p.name, 'active', { department: dept, groups: ['Test_VPP'] });
    const [x, y] = [await seedPwItem(page), await seedPwItem(page)];
    let admin: Page | undefined;
    // Đồng hồ dev không dời được: phiếu lưu ở kỳ mở rồi chuyển sang một kỳ quá khứ riêng (chưa chụp S) để giả lập khóa sổ
    const LOCKED_YM = '2003-05';
    const release = await acquireLock('prev-period');
    const createdPeriod = psql(
      `INSERT INTO periods (ym, deadline) VALUES ('${LOCKED_YM}-01', '${LOCKED_YM}-10T17:00:00Z') ON CONFLICT DO NOTHING RETURNING ym`,
    );
    try {
      const period = await (await request.get('/api/periods/current', { headers: memberHeaders(a.sub) })).json();
      const before = await summaryKpi(request, LOCKED_YM);

      await page.route('**/api/**', (route) => route.continue({ headers: { ...route.request().headers(), ...memberHeaders(a.sub) } }));
      await memberRegisters(page, info, [x, y], custom);
      const savedB = await request.put('/api/me/request/lines', {
        headers: memberHeaders(b.sub),
        data: { ym: period.ym, lines: [{ item_id: x.id, qty: 1 }] },
      });
      expect(savedB.status()).toBe(200);
      psql(`UPDATE requests SET period_ym = '${LOCKED_YM}-01' WHERE user_sub IN ('${a.sub}', '${b.sub}')`);

      admin = await adminPage(browser, info);
      await admin.goto(`/admin/summary?ym=${LOCKED_YM}`);
      await expect(admin.getByRole('heading', { level: 1, name: 'Tổng hợp kỳ' })).toBeVisible();
      await expect(admin.getByRole('button', { name: /Phiếu đã đăng ký/ })).toContainText(`${before.registered + 2}/${before.headcount}`);
      await copyUnregisteredList(admin, info);
      await expect(admin.getByText(/^Đã sao chép \d+ người$/)).toBeVisible();
      const copied = await admin.evaluate(() => navigator.clipboard.readText());
      expect(copied.split('\n')).toContain(`- ${c.name} (${dept})`);
      expect(copied).not.toContain(a.name);
      if (isMobile(info)) await expectNoContrastViolations(admin);
      await snap(admin, info, 'admin-summary');
      await adminAdjusts(admin, info, tag, a, custom, y.name);
      await admin.context().close();
      admin = undefined;

      await page.goto(`/history/${LOCKED_YM}`);
      await expect(page.locator('li', { hasText: x.name })).toBeVisible();
      // R-D6.11: dòng bị bỏ vẫn hiện ở Lịch sử kèm lý do của Hành chính
      await expect(page.locator('li', { hasText: y.name }).getByText(/^Hành chính bỏ món này khỏi phiếu \(\d+ cái\): Trùng với phiếu khác$/)).toBeVisible();
      await expect(page.locator('li', { hasText: custom }).getByText('Đã thêm vào danh mục')).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'member-a-after');

      const nav = page.getByRole('navigation', { name: isMobile(info) ? 'Điều hướng chính' : 'Chuyển trang' });
      await nav.getByRole('link', { name: 'Lịch sử' }).click();
      await expect(page.getByRole('link', { name: /Tháng 5\/2003/ })).toBeVisible();
      await snap(page, info, 'member-a-history');
    } finally {
      await admin?.context().close();
      deleteTestUsers(a.sub, b.sub, c.sub);
      if (createdPeriod) psql(`DELETE FROM periods WHERE ym = '${LOCKED_YM}-01' AND NOT EXISTS (SELECT 1 FROM requests WHERE period_ym = '${LOCKED_YM}-01')`);
      release();
      for (const it of [x, y]) await removeTestItem(request, it.id);
      const all: Item[] = await (await request.get('/api/admin/items', { headers: devHeaders('admin') })).json();
      const converted = all.find((i) => i.name === custom);
      if (converted) await removeTestItem(request, converted.id);
    }
  });
});
