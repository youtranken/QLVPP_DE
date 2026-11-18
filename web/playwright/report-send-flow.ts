import { expect, type Page } from '@playwright/test';

// "In trình ký" mở hộp xem trước (chưa lưu gì); "Đồng ý và in" mới chốt bản rồi mở hộp in.
// Cảnh báo món chờ duyệt / món đổi sau bản đã gửi nằm ngay trong hộp này, không còn hộp hỏi riêng
export async function previewAndPrint(page: Page) {
  await page.getByRole('button', { name: 'In trình ký' }).click();
  const dialog = page.getByRole('dialog', { name: /^Xem tổng kết tháng \d+\/\d{4}$/ });
  await expect(dialog.getByRole('heading', { name: 'Phiếu đề xuất văn phòng phẩm' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Đồng ý và in' }).click();
  await expect(dialog).toBeHidden();
}

// Kỳ khóa gần nhất luôn sửa được: trả về true khi kỳ đã có bản gửi (lần In sau là bản thay thế)
export async function openEditable(page: Page): Promise<boolean> {
  await expect(page.getByRole('button', { name: 'In trình ký' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('status').first()).toBeVisible();
  return (await page.getByRole('main').getByRole('status').first().textContent())?.startsWith('Đã gửi NCC') ?? false;
}

// Hộp "Các bản đã in / xuất" gập sẵn: mở ra rồi trả về hộp
export async function openCopies(page: Page) {
  const box = page.locator('details.bc-snaps-box');
  if (!(await box.evaluate((el) => (el as HTMLDetailsElement).open))) await box.locator('summary').click();
  return box;
}
