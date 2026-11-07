import { expect, test, type Page } from '@playwright/test';
import { asRole, devHeaders, expectNoContrastViolations, isMobile, settled, shot } from './helpers';

asRole('admin');

const STEP_LINKS = ['/admin/summary', '/admin/send-adm', '/admin/arrivals', '/admin/delivery'];
const fitsWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const steps = (page: Page) => page.getByRole('list', { name: /^(4 bước của tháng|The 4 steps of the month)$/ });

test.describe('Trang Tháng này (Plan v2-B, B6)', () => {
  test('Tháng này: 4 bước đúng thứ tự, đúng một nút đi thẳng, bấm là tới trang đó', async ({ page }, info) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/home$/);
    await expect(page.getByRole('heading', { level: 1, name: /^Chào / })).toBeVisible();
    await expect(steps(page).getByRole('listitem')).toHaveCount(4);
    const items = steps(page).getByRole('listitem');
    for (const [i, name] of ['Đăng ký', 'Gửi ADM', 'Hàng về', 'Giao'].entries()) await expect(items.nth(i)).toContainText(name);
    await settled(page);
    await shot(page, info, 'home');
    expect(await fitsWidth(page), 'không cuộn ngang').toBe(true);
    if (isMobile(info)) await expectNoContrastViolations(page);
    // Link phụ "Xem kỳ …" / "Xem bản đã gửi" không phải nút đi thẳng
    await expect(steps(page).getByRole('listitem').first().getByRole('link', { name: /^Xem kỳ \(tháng \d+\)$/ })).toBeVisible();
    const links = steps(page).getByRole('link').filter({ hasNotText: /^Xem / });
    const n = await links.count();
    expect(n).toBeLessThanOrEqual(1);
    if (n === 1) {
      const href = (await links.first().getAttribute('href'))!;
      // Bước Đăng ký dẫn Tổng hợp kèm ?ym= của kỳ khóa
      expect(STEP_LINKS).toContain(href.split('?')[0]);
      await links.first().click();
      await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === href);
    }
  });

  test('Tháng này: kỳ đang đăng ký chỉ bước 1 hoạt động; thẻ chưa đăng ký có chip + Chép tin nhắc, ẩn khi 0', async ({ page, request }, info) => {
    const period = await (await request.get('/api/periods/current', { headers: devHeaders('admin') })).json();
    const people = Array.from({ length: 9 }, (_, i) => ({ sub: `fake-${i}`, full_name: `Người thử ${i + 1}`, email: null, department: null }));
    let unreg = 9;
    await page.route(`**/api/admin/periods/${period.ym}/summary`, async (route) => {
      const res = await route.fetch({ headers: { ...route.request().headers(), ...devHeaders('admin') } });
      await route.fulfill({ response: res, json: { ...(await res.json()), unregistered: unreg } });
    });
    await page.route(`**/api/admin/periods/${period.ym}/unregistered`, (route) => route.fulfill({ json: { items: people.slice(0, unreg) } }));
    await page.goto('/admin/home');
    const card = page.getByRole('region', { name: `9 người chưa đăng ký kỳ tháng ${Number(period.ym.slice(5))}` });
    await expect(card).toBeVisible();
    await expect(card.getByRole('listitem').filter({ hasText: /Người thử \d/ })).toHaveCount(8);
    await expect(card.getByText('và 1 người khác')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Chép tin nhắc' })).toBeVisible();
    await settled(page);
    await shot(page, info, 'home-unregistered');
    if (isMobile(info)) await expectNoContrastViolations(page);

    await page.getByRole('radio', { name: /^Kỳ đang đăng ký/ }).click();
    await expect(steps(page).getByText('Sau khi khóa sổ')).toHaveCount(3);
    // Kỳ đang mở chưa có Tổng hợp: nút chỉ báo đang chờ chốt, không dẫn sang kỳ khác
    const month = Number((period.ym as string).slice(5, 7));
    await expect(steps(page).getByText(`Đang chờ chốt kỳ (tháng ${month})`)).toBeVisible();
    await expect(steps(page).getByRole('link')).toHaveCount(0);
    await settled(page);
    await shot(page, info, 'home-register');
    if (isMobile(info)) await expectNoContrastViolations(page);

    unreg = 0;
    await page.goto('/admin/home');
    await expect(steps(page)).toBeVisible();
    await expect(page.getByRole('heading', { name: /người chưa đăng ký kỳ tháng/ })).toHaveCount(0);
  });

  test('Tháng này: đổi sang English thì tên bước và nút đổi theo', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('vpp_lang', 'en'));
    await page.goto('/admin/home');
    await expect(page.getByRole('heading', { level: 1, name: /^Hello / })).toBeVisible();
    await expect(steps(page).getByRole('listitem')).toHaveCount(4);
    for (const name of ['Sign-up', 'Send to ADM', 'Goods in', 'Delivery']) await expect(steps(page).getByText(name, { exact: true })).toBeVisible();
  });
});
