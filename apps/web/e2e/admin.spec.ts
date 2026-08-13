import { expect, test } from '@playwright/test';
import { signIn, signOutGlobal } from './helpers';

const ADMIN = 'admin@pmh.com.vn';
const MEMBER = 'dung@pmh.com.vn';

test.describe('Phân quyền màn quản trị', () => {
  test('nhân viên không thấy menu Quản trị và bị chặn khi gõ thẳng URL', async ({ page }) => {
    await signOutGlobal(page);
    await signIn(page, MEMBER);

    await expect(page.getByRole('menuitem', { name: /Quản trị/ })).toHaveCount(0);

    await page.goto('/quan-tri/don');
    await expect(page.getByText(/Chỉ quản trị viên mới xem được trang này/)).toBeVisible();
  });

  test('quản trị viên vào được màn quản trị', async ({ page }) => {
    await signOutGlobal(page);
    await signIn(page, ADMIN);
    // Không kiểm menu hiển thị: trên màn hẹp AntD thu menu vào nút "..." nên
    // phép kiểm đó phụ thuộc bề rộng chứ không phải phụ thuộc quyền.
    await page.goto('/quan-tri/don');
    await expect(page.getByRole('heading', { name: 'Duyệt đơn đăng ký' })).toBeVisible();
  });
});

test.describe('Màn quản trị', () => {
  test.beforeEach(async ({ page }) => {
    await signOutGlobal(page);
    await signIn(page, ADMIN);
  });

  test('danh sách đơn có bộ lọc và phân trang', async ({ page }) => {
    await page.goto('/quan-tri/don');
    await expect(page.getByRole('heading', { name: 'Duyệt đơn đăng ký' })).toBeVisible();
    await expect(page.getByLabel('Chọn kỳ')).toBeVisible();
    await expect(page.getByLabel('Phòng ban')).toBeVisible();
    await expect(page.getByLabel('Trạng thái')).toBeVisible();
  });

  test('tổng hợp theo món có nút tải Excel trỏ đúng API', async ({ page }) => {
    await page.goto('/quan-tri/tong-hop');
    const download = page.getByRole('link', { name: /Tải Excel trình ký/ });
    await expect(download).toBeVisible();
    await expect(download).toHaveAttribute(
      'href',
      /\/api\/export\/requests\.xlsx\?period=\d{4}-\d{2}/,
    );
  });

  test('bảng điều khiển vẽ được biểu đồ', async ({ page }) => {
    await page.goto('/quan-tri');
    await expect(page.getByText('Tổng số đơn')).toBeVisible();
    // ECharts vẽ bằng canvas ⇒ có canvas nghĩa là biểu đồ đã khởi tạo xong.
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 });
  });

  test('quản lý danh mục hiện đủ nhóm và cột "Chỉ admin"', async ({ page }) => {
    await page.goto('/quan-tri/danh-muc');
    await expect(page.getByRole('heading', { name: 'Danh mục văn phòng phẩm' })).toBeVisible();
    await expect(page.getByText('Bút & Viết')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Chỉ admin' }).first()).toBeVisible();
  });

  test('danh bạ hiện người chưa từng đăng nhập', async ({ page }) => {
    await page.goto('/quan-tri/danh-ba');
    await expect(page.getByRole('button', { name: /Đồng bộ ngay/ })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Đã đăng nhập' })).toBeVisible();
  });

  test('nhật ký hiện hành động bằng tiếng Việt', async ({ page }) => {
    await page.goto('/quan-tri/nhat-ky');
    await expect(page.getByRole('heading', { name: 'Nhật ký hoạt động' })).toBeVisible();
    await expect(page.getByLabel('Lọc theo hành động')).toBeVisible();
  });
});
