import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { devHeaders } from './helpers';

// Kỳ seed có thể còn món chờ duyệt do dữ liệu dev, hoặc đây là bản thay thế: hộp hỏi hiện thì bấm nút chốt trong hộp
export async function confirmIfAsked(page: Page, request: APIRequestContext, ym: string, replacing: boolean) {
  const report = await (await request.get(`/api/admin/reports/${ym}`, { headers: devHeaders('admin') })).json();
  if (report.pending_custom_count === 0 && !replacing) return;
  await page.getByRole('dialog').getByRole('button', { name: 'In trình ký' }).click();
}

// Kỳ khóa gần nhất luôn sửa được: trả về true khi kỳ đã có bản gửi (lần In sau là bản thay thế)
export async function openEditable(page: Page): Promise<boolean> {
  await expect(page.getByRole('button', { name: 'In trình ký' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('status').first()).toBeVisible();
  return (await page.getByRole('main').getByRole('status').first().textContent())?.startsWith('Đã gửi ADM') ?? false;
}

// Hộp "Các bản đã in / xuất" gập sẵn: mở ra rồi trả về hộp
export async function openCopies(page: Page) {
  const box = page.locator('details.bc-snaps-box');
  if (!(await box.evaluate((el) => (el as HTMLDetailsElement).open))) await box.locator('summary').click();
  return box;
}
