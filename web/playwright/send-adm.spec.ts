import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { acquireLock, asRole, devHeaders, expectNoContrastViolations, isMobile, psql, settled, shot } from './helpers';
import { seedLockedRequest, type Seed } from './locked-request';

asRole('admin');

const fitsWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

// Kỳ seed có thể còn món chờ duyệt do dữ liệu dev: hộp hỏi hiện thì bấm nút chốt trong hộp
async function confirmIfAsked(page: Page, request: APIRequestContext, ym: string, replacing: boolean) {
  const report = await (await request.get(`/api/admin/reports/${ym}`, { headers: devHeaders('admin') })).json();
  if (report.pending_custom_count === 0 && !replacing) return;
  await page.getByRole('dialog').getByRole('button', { name: 'In trình ký' }).click();
}

// Dữ liệu dev có thể đã có bản gửi của kỳ này: khi đó mở Lập phiếu bằng "Làm bản mới"
async function openDraft(page: Page) {
  const newDraft = page.getByRole('button', { name: 'Làm bản mới' });
  const print = page.getByRole('button', { name: 'In trình ký' });
  await expect(newDraft.or(print).first()).toBeVisible();
  if (await newDraft.isVisible()) {
    await newDraft.click();
    await page.getByRole('dialog', { name: 'Làm bản mới?' }).getByRole('button', { name: 'Làm bản mới' }).click();
  }
  await expect(print).toBeVisible();
}

test.describe('Gửi ADM (Plan v2-D, Task 6)', () => {
  let run: { release: () => void; since: string; seed?: Seed };
  test.beforeEach(async () => {
    run = { release: await acquireLock('prev-period'), since: new Date().toISOString() };
  });
  test.afterEach(() => {
    // report_snapshots có FK tới periods: xóa bản chốt của lần chạy trước khi dọn kỳ seed
    if (run.seed) psql(`DELETE FROM report_snapshots WHERE period_ym = '${run.seed.prevYm}-01' AND created_by_sub = 'pw-admin' AND created_at >= '${run.since}'`);
    run.seed?.cleanup();
    run.release();
  });

  test('V2D-6 draft→print→new draft', async ({ page, request }, info) => {
    const seed = (run.seed = await seedLockedRequest(request, info, [{ stock: 0, qty: 13 }]));
    const [item] = seed.items;
    await page.goto('/admin/send-adm');
    await expect(page.getByRole('heading', { level: 1, name: `Gửi ADM, kỳ tháng ${Number(seed.prevYm.slice(5))}` })).toBeVisible();
    await openDraft(page);

    const rowOf = () => page.getByRole('table', { name: 'Số đề nghị theo món' }).getByRole('row').filter({ hasText: item.name });
    await expect(rowOf()).toContainText('= 13 đăng ký + 0 nợ');
    await expect(rowOf().getByRole('spinbutton')).toHaveCount(0);
    await rowOf().getByRole('button', { name: 'Sửa số' }).click();
    await rowOf().getByRole('spinbutton').fill('10');
    await expect(rowOf()).toContainText('Đã sửa: 10 (gợi ý 13)');
    await expect(rowOf().getByRole('status')).toContainText('Thiếu 3 — 3');
    await settled(page);
    await shot(page, info, 'send-adm-draft');
    if (isMobile(info)) {
      await expectNoContrastViolations(page);
      expect(await fitsWidth(page), 'trang không cuộn ngang ở 390').toBe(true);
    } else {
      await page.setViewportSize({ width: 1024, height: 800 });
      const desc = page.locator('header p').filter({ hasText: 'Phiếu đúng mẫu sheet phòng' });
      expect(await desc.evaluate((el) => el.scrollWidth <= el.clientWidth && getComputedStyle(el).whiteSpace !== 'nowrap'), 'dòng giới thiệu không bị cắt ở 1024').toBe(true);
      await page.setViewportSize({ width: 1280, height: 800 });
    }

    await page.getByRole('button', { name: 'In trình ký' }).click();
    await confirmIfAsked(page, request, seed.prevYm, false);
    await expect(page.getByText(/^Đã gửi ADM lúc \d\d:\d\d \d\d\/\d\d · /)).toBeVisible();
    const sentRow = page.getByRole('table', { name: 'Số đã gửi theo món' }).getByRole('row').filter({ hasText: item.name });
    await expect(sentRow).toContainText('10');
    await shot(page, info, 'send-adm-sent');

    await page.getByRole('button', { name: 'Làm bản mới' }).click();
    await page.getByRole('dialog', { name: 'Làm bản mới?' }).getByRole('button', { name: 'Làm bản mới' }).click();
    await expect(rowOf()).toContainText('Đã sửa: 10 (gợi ý 13)');
    await rowOf().getByRole('button', { name: 'Về số gợi ý' }).click();
    await page.getByRole('button', { name: 'In trình ký' }).click();
    const replace = page.getByRole('dialog', { name: /^Bản mới thay thế bản in lúc/ });
    await expect(replace.getByRole('listitem').filter({ hasText: item.name })).toHaveText(`${item.name} 10 → 13`);
    await confirmIfAsked(page, request, seed.prevYm, true);
    await expect(page.getByText(/\(thay thế bản \d\d:\d\d \d\d\/\d\d\)$/)).toBeVisible();
    await expect(sentRow).toContainText('13');

    await page.getByRole('button', { name: 'In lại bản này' }).click();
    await expect(page).toHaveURL(/\/admin\/reports\/snapshots\/[0-9a-f-]{36}\/print\?from=send-adm$/);
    await expect(page.getByRole('row').filter({ hasText: item.name }).first()).toContainText('13');
  });
});
