import { mkdirSync } from 'node:fs';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { acquireLock, deleteTestUsers, expectNoContrastViolations, isMobile, psql, seedActiveUser, settled } from './helpers';
import { seedLockedRequest, type Seed } from './locked-request';

const SHOTS = '../.superpowers/sdd/2026-10-29-vpp-gd1-p3-giao-bao-cao/task-16-shots';
const VIETNAMESE = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;

type Lang = 'vi' | 'en';

async function snap(page: Page, info: TestInfo, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await settled(page);
  await page.screenshot({ path: `${SHOTS}/${name}-${info.project.name}.png`, fullPage: true });
}

async function switchLanguage(page: Page, lang: Lang) {
  await page.goto('/me');
  await page.getByRole('radio', { name: lang === 'en' ? 'English' : 'Tiếng Việt' }).click();
  await expect(page.getByRole('heading', { level: 1, name: lang === 'en' ? 'Me' : 'Tôi' })).toBeVisible();
}

// Vỏ app có tên người đăng nhập và tên ngôn ngữ "Tiếng Việt"; ô dữ liệu (ghi chú xuất lẻ, tên món) là chữ người dùng nhập
// → chỉ kiểm chữ giao diện: tiêu đề, nút, đầu cột, nhãn trong vùng nội dung chính
async function expectContentLanguage(page: Page, lang: Lang) {
  await settled(page);
  const ui = await page.getByRole('main').locator('h1, h2, h3, button, th, label, legend').allInnerTexts();
  const words = ui.join(' ').match(/\S*[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]\S*/gi) ?? [];
  if (lang === 'en') expect(words).toEqual([]);
  else expect(words.length).toBeGreaterThan(0);
}

test.describe('E6-S4 song ngữ các màn Hành chính của Plan 3', () => {
  test('E6-S4 Giao hàng, Còn nợ, Báo cáo, Lịch sử, chuông: en không còn chữ Việt trong nội dung, axe 390 sạch ở cả vi và en', async ({ page }, info) => {
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
        await switchLanguage(page, lang);
        const t = lang === 'vi' ? { delivery: 'Giao tất cả', backlog: 'Còn nợ', reports: 'In trình ký', bell: 'Thông báo' } : { delivery: 'Deliver all', backlog: 'Outstanding', reports: 'Print for signing', bell: 'Notifications' };

        await page.goto('/admin/delivery');
        await page.getByRole('button', { name: new RegExp(`^${seed.name}`) }).click();
        await expect(page.getByRole('button', { name: t.delivery })).toBeVisible();
        await expectContentLanguage(page, lang);
        if (isMobile(info)) await expectNoContrastViolations(page);
        await snap(page, info, `delivery-${lang}`);

        await page.goto('/admin/backlog');
        await expect(page.getByRole('heading', { level: 1, name: t.backlog })).toBeVisible();
        await expectContentLanguage(page, lang);
        if (isMobile(info)) await expectNoContrastViolations(page);
        await snap(page, info, `backlog-${lang}`);

        await page.goto('/admin/reports');
        await expect(page.getByRole('button', { name: t.reports })).toBeVisible();
        await expectContentLanguage(page, lang);
        if (isMobile(info)) await expectNoContrastViolations(page);
        await snap(page, info, `reports-${lang}`);

        await page.goto('/history');
        await expect(page.getByRole('heading', { level: 1, name: lang === 'vi' ? 'Lịch sử' : 'History' })).toBeVisible();
        await expectContentLanguage(page, lang);
        if (isMobile(info)) await expectNoContrastViolations(page);
        await snap(page, info, `history-${lang}`);

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
