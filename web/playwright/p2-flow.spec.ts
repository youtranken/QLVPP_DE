import { mkdirSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import { acquireLock, deleteTestUsers, devHeaders, expectNoContrastViolations, isMobile, monthRowAction, pickOption, psql, removeTestItem, searchMonthPeople, seedActiveUser, seedPwItem, settled, skipNewPeriodPopup } from './helpers';
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
  await grid.getByRole('button', { name: /Không thấy món cần\?/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Thêm món khác' });
  await dialog.getByLabel('Tên món').fill(custom);
  await pickOption(dialog.getByRole('combobox', { name: 'Đơn vị tính' }), 'cái');
  await dialog.getByRole('button', { name: 'Thêm vào phiếu' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: isMobile(info) ? 'Lưu phiếu' : '3 thay đổi chưa lưu · Lưu' }).click();
  await page.getByRole('dialog', { name: /^Lưu phiếu tháng/ }).getByRole('button', { name: 'Lưu phiếu' }).click();
  await expect(page.getByRole('region', { name: /^Đăng ký văn phòng phẩm/ }).getByText(/^Đã lưu \d{2}:\d{2}$/)).toBeVisible();
  await snap(page, info, 'member-a-saved');
}

// Kỳ khóa: G8 duyệt món ngoài DM trong Xem phiếu (tick "Thêm luôn vào danh mục" → món mới), G2 từ chối dòng y bằng hộp Điều chỉnh
async function adminAdjusts(admin: Page, info: TestInfo, tag: string, a: Person, custom: string, dropped: string) {
  await searchMonthPeople(admin, tag);
  await monthRowAction(admin, a.name, 'Xem phiếu');
  const view = admin.getByRole('dialog', { name: `Phiếu của ${a.name}` });
  const line = view.getByRole('listitem').filter({ hasText: custom });
  await line.getByRole('checkbox', { name: 'Thêm luôn vào danh mục' }).check();
  await line.getByRole('button', { name: `Chấp nhận ${custom}` }).click();
  const convert = admin.getByRole('dialog', { name: 'Sản phẩm mới' });
  await convert.getByRole('radiogroup', { name: 'Nhóm' }).getByRole('radio').first().click();
  // Dòng Món khác không có ảnh → món mới phải có ảnh mới chọn ở đây
  await convert.getByLabel('Chụp hoặc chọn ảnh').setInputFiles(FIXTURE);
  await expect(convert.getByRole('img', { name: 'Ảnh món' })).toBeVisible();
  await convert.getByRole('button', { name: 'Mua và thêm vào danh mục', exact: true }).click();
  await expect(convert).toBeHidden();
  await expect(line.getByRole('button', { name: `Chấp nhận ${custom}` })).toHaveCount(0);
  await snap(admin, info, 'admin-converted');
  await view.getByRole('button', { name: 'Đóng' }).last().click();

  await monthRowAction(admin, a.name, 'Điều chỉnh phiếu');
  const adjust = admin.getByRole('dialog', { name: `Điều chỉnh phiếu ${a.name}` });
  await adjust.getByRole('checkbox', { name: `Chọn ${dropped}` }).check();
  await adjust.getByRole('radiogroup', { name: `Cách điều chỉnh ${dropped}` }).getByRole('radio', { name: 'Từ chối' }).check();
  await adjust.getByRole('radiogroup', { name: 'Lý do' }).getByRole('radio', { name: 'Hết hàng' }).check();
  await snap(admin, info, 'admin-adjust');
  await adjust.getByRole('button', { name: 'Lưu 1 thay đổi' }).click();
  await expect(adjust).toBeHidden();
}

async function summaryKpi(request: APIRequestContext, ym: string) {
  const res = await request.get(`/api/admin/periods/${ym}/summary`, { headers: devHeaders('admin') });
  expect(res.status()).toBe(200);
  return (await res.json()) as { registered: number; headcount: number };
}

test.describe('Smoke Plan 2 toàn luồng', () => {
  // Popup kỳ mới (vòng 4) phủ trang Đăng ký của A chưa lưu phiếu: smoke này không thử popup
  test.beforeEach(({ page }) => skipNewPeriodPopup(page));

  test('Plan 2: A đăng ký 2 món + 1 món ngoài DM, B lưu 1 món → kỳ khóa → Adm D&E Tổng hợp, sao chép chưa đăng ký có C, bỏ một món khỏi phiếu A có lý do, Thêm vào danh mục → A thấy ở Lịch sử kỳ đó món bị bỏ kèm lý do và "Đã thêm vào danh mục"', async ({
    page,
    browser,
    request,
  }, info) => {
    // Hai trình duyệt + tải ảnh: chạy riêng đã ~24 s, sát mức 30 s mặc định khi máy bận
    test.setTimeout(90_000);
    const tag = `${Date.now().toString(36)}${isMobile(info) ? 'm' : 'd'}`;
    const dept = `PW Phòng P2 ${tag}`;
    const [a, b, c]: Person[] = ['a', 'b', 'c'].map((k) => ({ sub: `pw-p2-${k}-${tag}`, name: `PW P2 ${k.toUpperCase()} ${tag}` }));
    const custom = `PW kẹp giấy P2 ${tag}`;
    for (const p of [a, b, c]) seedActiveUser(p.sub, p.name, 'active', { department: dept });
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
      await admin.goto(`/admin/month?ym=${LOCKED_YM}`);
      await expect(admin.getByRole('heading', { level: 1, name: /^Kỳ tháng \d+$/ })).toBeVisible();
      await expect(admin.getByRole('list', { name: 'Các bước của tháng' }).getByRole('listitem').first()).toContainText(`${before.registered + 2}/${before.headcount}`);
      if (isMobile(info)) await expectNoContrastViolations(admin);
      await snap(admin, info, 'admin-summary');
      await adminAdjusts(admin, info, tag, a, custom, y.name);
      await admin.context().close();
      admin = undefined;

      await page.goto(`/history/${LOCKED_YM}`);
      // 390 mỗi món một dòng danh sách thay cho dòng bảng
      const line = (name: string) => page.getByRole(isMobile(info) ? 'listitem' : 'row').filter({ hasText: name });
      await expect(line(x.name)).toBeVisible();
      // R-D6.11: dòng bị bỏ vẫn hiện ở Lịch sử kèm lý do của Hành chính
      await expect(line(y.name).getByText('Adm D&E bỏ món · Hết hàng')).toBeVisible();
      await expect(line(custom).getByText('Đã thêm vào danh mục')).toBeVisible();
      if (isMobile(info)) await expectNoContrastViolations(page);
      await snap(page, info, 'member-a-after');

      const nav = page.getByRole('navigation', { name: isMobile(info) ? 'Điều hướng chính' : 'Chuyển trang' });
      await nav.getByRole('link', { name: 'Lịch sử' }).click();
      await expect(page.getByRole('heading', { level: 2, name: '2003', exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: /^Tháng 5(?!\d)/ })).toBeVisible();
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
