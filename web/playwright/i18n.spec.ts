import { mkdirSync } from 'node:fs';
import { expect, test, type Browser, type Locator, type Page, type TestInfo } from '@playwright/test';
import { acquireLock, deleteTestUsers, expectNoContrastViolations, isMobile, psql, seedActiveUser, settled } from './helpers';
import { seedLockedRequest, type Seed } from './locked-request';
import { newPage } from './sessions';

const SHOTS = '../.superpowers/sdd/2026-10-29-vpp-gd1-p3-giao-bao-cao/task-16-shots';
const VIETNAMESE = /[àáãăâđèéêìíòóõôơùúưýạảấầẩẫậắằẳẵặẹẻẽếềểễệỉĩịọỏốồổỗộớờởỡợụủũứừửữựỳỵỷỹ]/i;

type Lang = 'vi' | 'en';

async function snap(page: Page, info: TestInfo, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await settled(page);
  await page.screenshot({ path: `${SHOTS}/${name}-${info.project.name}.png`, fullPage: true });
}

// Hành chính không có /me: đổi ngôn ngữ ở đáy sidebar, điện thoại thì trong menu quản lý
async function switchLanguage(page: Page, info: TestInfo, lang: Lang) {
  await page.goto('/admin/month');
  if (isMobile(info)) await page.getByRole('button', { name: /^(Mở menu quản lý|Open admin menu)$/ }).click();
  else await page.getByRole('button', { name: /^(Ngôn ngữ|Language)$/ }).click();
  await page.getByRole('radio', { name: lang === 'en' ? 'English' : 'Tiếng Việt' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { level: 1, name: lang === 'en' ? /^Month \d+$/ : /^Kỳ tháng \d+$/ })).toBeVisible();
}

// Vỏ app có tên người đăng nhập và tên ngôn ngữ "Tiếng Việt"; ô dữ liệu (ghi chú xuất lẻ, tên món) là chữ người dùng nhập
// → chỉ kiểm chữ giao diện: tiêu đề, nút, đầu cột, nhãn trong vùng nội dung chính
// Hộp thoại modal làm main bị aria-hidden (getByRole('main') không còn khớp): khi có hộp mở thì kiểm trong hộp
async function expectContentLanguage(page: Page, lang: Lang, root: Locator = page.getByRole('main')) {
  await settled(page);
  await expect(root).toBeVisible();
  const ui = await root.locator('h1, h2, h3, button, th, label, legend').allInnerTexts();
  // Nút chọn phiếu mang tên người/phòng ban (dữ liệu, có thể là người demo trong DB dev) — không phải chữ giao diện
  const text = userDataTexts().reduce((t, d) => t.split(d).join(' '), ui.join(' '));
  const words = text.match(/\S*[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]\S*/gi) ?? [];
  if (lang === 'en') expect(words).toEqual([]);
  else expect(words.length).toBeGreaterThan(0);
}

test.describe('E6-S4 song ngữ các màn Hành chính của Plan 3', () => {
  test('E6-S4 Giao hàng, Còn nợ, Báo cáo, Lịch sử, chuông: en không còn chữ Việt trong nội dung, axe 390 sạch ở cả vi và en', async ({ page, browser }, info) => {
    // 5 màn × 2 ngôn ngữ + trang Nhân viên riêng cho Lịch sử
    test.setTimeout(90_000);
    const release = await acquireLock('prev-period');
    let seed: Seed | undefined;
    const admin = `pw-i18n-${Date.now().toString(36)}${isMobile(info) ? 'm' : 'd'}`;
    try {
      seed = await seedLockedRequest(page.request, info, [{ stock: 10, qty: 5 }]);
      psql(`UPDATE users SET department = 'PW Dept' WHERE sub = '${seed.sub}'`);
      seedActiveUser(admin, `PW Admin ${admin}`);
      psql(`INSERT INTO in_app_notifications (user_sub, event_id, topic, params, link)
        VALUES ('${admin}', 'pw:${admin}:1', 'low_stock', '{"name":"PW but","name_en":"PW pen","stock_qty":2}'::jsonb, '/')`);
      await page.route('**/api/**', (route) =>
        route.continue({ headers: { ...route.request().headers(), 'x-dev-user-sub': admin, 'x-dev-role': 'admin' } }),
      );

      for (const lang of ['vi', 'en'] as const) {
        await switchLanguage(page, info, lang);
        const t = lang === 'vi' ? { delivery: 'Xác nhận giao', backlog: 'Còn nợ', reports: 'Báo cáo & gửi ADM', bell: 'Thông báo' } : { delivery: 'Confirm delivery', backlog: 'Outstanding', reports: 'Reports & send to ADM', bell: 'Notifications' };

        await page.goto('/admin/delivery');
        await page.getByRole('searchbox').fill(seed.name);
        await page.getByRole('button', { name: new RegExp(`^${lang === 'vi' ? 'Giao…' : 'Deliver…'}, ${seed.name}`) }).click();
        await expect(page.getByRole('button', { name: t.delivery })).toBeVisible();
        await expectContentLanguage(page, lang, page.getByRole('dialog'));
        if (isMobile(info)) await expectNoContrastViolations(page);
        await snap(page, info, `delivery-${lang}`);

        await page.goto('/admin/backlog');
        await expect(page.getByRole('heading', { level: 1, name: t.backlog })).toBeVisible();
        await expectContentLanguage(page, lang);
        if (isMobile(info)) await expectNoContrastViolations(page);
        await snap(page, info, `backlog-${lang}`);

        // Báo cáo & gửi ADM: chờ đầu trang có số liệu
        await page.goto('/admin/reports');
        await expect(page.getByRole('heading', { name: t.reports })).toBeVisible();
        await expectContentLanguage(page, lang);
        if (isMobile(info)) await expectNoContrastViolations(page);
        await snap(page, info, `reports-${lang}`);

        // Lịch sử chỉ dành cho Nhân viên: xem bằng chính người có phiếu đã khóa
        const member = await newPage(browser, info, { 'x-dev-user-sub': seed.sub, 'x-dev-role': 'member' });
        try {
          await member.goto('/');
          await member.evaluate((l) => localStorage.setItem('vpp_lang', l), lang);
          await member.goto('/history');
          await expect(member.getByRole('heading', { level: 1, name: lang === 'vi' ? 'Lịch sử' : 'History' })).toBeVisible();
          await expectContentLanguage(member, lang);
          if (isMobile(info)) await expectNoContrastViolations(member);
          await snap(member, info, `history-${lang}`);
        } finally {
          await member.context().close();
        }

        await page.getByRole('button', { name: new RegExp(`^${t.bell}, \\d+ ${lang === 'vi' ? 'chưa đọc' : 'unread'}$`) }).click();
        const panel = page.getByRole('dialog', { name: t.bell });
        await expect(panel.getByText(lang === 'vi' ? /sắp hết kho/ : /running low/)).toBeVisible();
        if (lang === 'en') expect((await panel.innerText()).match(VIETNAMESE)).toBeNull();
        if (isMobile(info)) await expectNoContrastViolations(page);
        await snap(page, info, `bell-${lang}`);
        await page.keyboard.press('Escape');
      }
    } finally {
      await page.evaluate(() => localStorage.removeItem('vpp_lang')).catch(() => undefined);
      psql(`DELETE FROM in_app_notifications WHERE user_sub = '${admin}'`);
      deleteTestUsers(admin);
      seed?.cleanup();
      release();
    }
  });
});

// Chữ người dùng nhập (tên món/nhóm/người/phòng ban, ghi chú, lý do) giữ nguyên ngôn ngữ gốc ở mọi giao diện
function userDataTexts(): string[] {
  const rows = psql(`SELECT DISTINCT x FROM (
      SELECT name AS x FROM items UNION ALL SELECT name_en FROM items UNION ALL SELECT pack_note FROM items UNION ALL SELECT name FROM item_categories
      UNION ALL SELECT full_name FROM users UNION ALL SELECT department FROM users UNION ALL SELECT department FROM requests
      UNION ALL SELECT custom_name FROM request_lines UNION ALL SELECT custom_note FROM request_lines
      UNION ALL SELECT review_note FROM request_lines UNION ALL SELECT cancel_note FROM request_lines
      UNION ALL SELECT note FROM stock_movements UNION ALL SELECT name_en FROM units) t
    WHERE x IS NOT NULL AND x <> ''`);
  // Chỉ chuỗi có dấu tiếng Việt mới ảnh hưởng kết quả; bỏ chuỗi ngắn để không xóa nhầm chữ giao diện
  const vietnamese = rows.split('\n').filter((x) => x.length >= 3 && VIETNAMESE.test(x));
  // Tên ĐVT do Hành chính tự đặt, có tên chỉ 2 chữ (vd "vỉ") nên không qua bộ lọc độ dài
  const units = psql('SELECT name FROM units').split('\n').filter((x) => VIETNAMESE.test(x));
  return [...vietnamese, ...units, 'Tiếng Việt'].sort((a, b) => b.length - a.length);
}

// Quét mọi chữ thấy được (không chỉ tiêu đề/nút): bỏ ô dữ liệu bảng, bỏ chữ người dùng nhập, còn chữ Việt là chuỗi chưa dịch
async function vietnameseLeftovers(page: Page, data: string[]) {
  await settled(page);
  const text = await page.evaluate(() => {
    const out: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest('td, [role=cell], script, style, [hidden], [aria-hidden=true]')) continue;
      if (el.checkVisibility && !el.checkVisibility()) continue;
      out.push(n.textContent ?? '');
    }
    return out.join(' | ');
  });
  const stripped = data.reduce((t, d) => t.split(d).join(' '), text);
  return stripped.match(new RegExp(`\\S*${VIETNAMESE.source}\\S*`, 'gi')) ?? [];
}

const ADMIN_SCREENS = ['/admin/month', '/admin/review', '/admin/delivery', '/admin/backlog', '/admin/reports', '/admin/stock', '/admin/catalog', '/admin/categories', '/admin/users', '/admin/audit', '/admin/config'];
const MEMBER_SCREENS = ['/', '/history', '/me'];

async function englishPage(browser: Browser, info: TestInfo, headers?: Record<string, string>) {
  const page = await newPage(browser, info, headers);
  await page.addInitScript(() => localStorage.setItem('vpp_lang', 'en'));
  return page;
}

test.describe('E6-S4 song ngữ mọi màn PRD §8', () => {
  test('E6-S4 en: Đăng nhập, Chưa được cấp quyền, mọi màn member và Hành chính không còn chữ Việt ngoài dữ liệu người dùng', async ({ browser }, info) => {
    test.setTimeout(120_000);
    const sub = `pw-i18n-all-${Date.now().toString(36)}${isMobile(info) ? 'm' : 'd'}`;
    seedActiveUser(sub, `PW i18n ${sub}`);
    const data = userDataTexts();
    const found: Record<string, string[]> = {};
    const check = async (page: Page, path: string, ready: () => Promise<void>) => {
      await page.goto(path);
      await ready();
      const words = await vietnameseLeftovers(page, data);
      if (words.length) found[path] = words;
      if (isMobile(info)) await expectNoContrastViolations(page);
    };
    const pages: Page[] = [];
    try {
      const guest = await englishPage(browser, info);
      pages.push(guest);
      await check(guest, '/', () => expect(guest.getByRole('button', { name: 'Sign in with your company account (PMH ID)' })).toBeVisible());
      await check(guest, '/?login=forbidden', () => expect(guest.getByRole('button', { name: 'Sign in with another account' })).toBeVisible());

      const member = await englishPage(browser, info, { 'x-dev-user-sub': sub, 'x-dev-role': 'member' });
      pages.push(member);
      for (const path of MEMBER_SCREENS) await check(member, path, () => expect(member.getByRole('heading', { level: 1 })).toBeVisible());
      await member.goto('/');
      await member.getByRole('button', { name: isMobile(info) ? 'Me' : /^Open account for / }).click();
      const account = member.getByRole('dialog', { name: 'Account' });
      await account.getByRole('radio', { name: 'English' }).click();
      await expect(account.getByRole('radio', { name: 'English' })).toBeChecked();

      const admin = await englishPage(browser, info, { 'x-dev-user-sub': sub, 'x-dev-role': 'admin' });
      pages.push(admin);
      for (const path of ADMIN_SCREENS) await check(admin, path, () => expect(admin.getByRole('heading', { level: 1 })).toBeVisible());
      expect(found).toEqual({});
    } finally {
      for (const p of pages) await p.context().close();
      deleteTestUsers(sub);
    }
  });
});
