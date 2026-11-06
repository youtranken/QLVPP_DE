import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { devHeaders } from './helpers';

// Kỳ seed có thể còn món chờ duyệt do dữ liệu dev, hoặc đây là bản thay thế: hộp hỏi hiện thì bấm nút chốt trong hộp
export async function confirmIfAsked(page: Page, request: APIRequestContext, ym: string, replacing: boolean) {
  const report = await (await request.get(`/api/admin/reports/${ym}`, { headers: devHeaders('admin') })).json();
  if (report.pending_custom_count === 0 && !replacing) return;
  await page.getByRole('dialog').getByRole('button', { name: 'In trình ký' }).click();
}

// Dữ liệu dev có thể đã có bản gửi của kỳ này: khi đó mở Lập phiếu bằng "Làm bản mới"; trả về true nếu là bản thay thế
export async function openDraft(page: Page): Promise<boolean> {
  const newDraft = page.getByRole('button', { name: 'Làm bản mới' });
  const print = page.getByRole('button', { name: 'In trình ký' });
  await expect(newDraft.or(print).first()).toBeVisible();
  const replacing = await newDraft.isVisible();
  if (replacing) {
    await newDraft.click();
    await page.getByRole('dialog', { name: 'Làm bản mới?' }).getByRole('button', { name: 'Làm bản mới' }).click();
  }
  await expect(print).toBeVisible();
  return replacing;
}
