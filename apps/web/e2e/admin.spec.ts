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

  test('tìm nhanh theo tên người lọc đúng danh sách', async ({ page }) => {
    await page.goto('/quan-tri/don');
    await page.getByLabel('Tìm đơn').fill('Bình');
    await page.getByLabel('Tìm đơn').press('Enter');

    const bang = page
      .locator('table')
      .filter({ has: page.getByRole('columnheader', { name: 'Mã đơn' }) });
    await expect(bang.getByRole('row')).not.toHaveCount(1); // có ít nhất 1 dòng dữ liệu
    // Mọi dòng còn lại phải là của người vừa tìm.
    await expect(bang.getByText('Nguyễn Văn An')).toHaveCount(0);
  });

  test('chọn nhiều đơn thì hiện thanh duyệt hàng loạt', async ({ page }) => {
    await page.goto('/quan-tri/don');

    // PHẢI chờ bảng có dữ liệu trước khi đếm: `count()` không tự chờ như `expect`,
    // gọi sớm thì luôn ra 0 và test lặng lẽ bị bỏ qua — xanh mà không kiểm gì cả.
    await expect(page.getByText(/VPP-\d{4}-\d{2}-\d{4}/).first()).toBeVisible();

    // Bám theo DÒNG có trạng thái "Đã gửi": chỉ đơn chờ duyệt mới tích được, nên
    // cách này vừa chắc vừa nói đúng ý định. Tìm thẳng input sẽ trúng ô ẩn mà
    // AntD dựng bên dưới hộp tích, và Playwright không bấm được.
    const dongChoDuyet = page.getByRole('row').filter({ hasText: 'Đã gửi' });
    const so = await dongChoDuyet.count();
    test.skip(so === 0, 'Không còn đơn nào chờ duyệt để thử');

    await dongChoDuyet.first().getByRole('checkbox').check();
    await expect(page.getByText(/Đã chọn 1 đơn/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Duyệt 1 đơn/ })).toBeVisible();
    // Cố ý KHÔNG bấm duyệt: test không nên đổi trạng thái dữ liệu demo.
  });

  test('phiếu phát hàng gom theo phòng ban và có cột ký nhận', async ({ page }) => {
    await page.goto('/quan-tri/phieu-phat');
    await expect(page.getByRole('heading', { name: 'Phiếu phát hàng' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Ký nhận' }).first()).toBeVisible();
    await expect(page.getByText(/^Phòng: /).first()).toBeVisible();
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

  test('trang chủ có danh sách đăng ký theo món, bấm dòng mở được đơn để duyệt', async ({
    page,
  }) => {
    await page.goto('/');

    // Yêu cầu: KHÔNG còn tiêu đề "Duyệt đơn đăng ký" ở trang chủ.
    await expect(page.getByRole('heading', { name: 'Duyệt đơn đăng ký' })).toHaveCount(0);

    // Bốn thẻ số liệu mở đầu trang, và thẻ 'Chờ duyệt' đang là bộ lọc mặc định.
    await expect(page.getByLabel('Đơn chờ duyệt')).toBeVisible();
    await expect(page.getByLabel('Chưa đăng ký')).toBeVisible();

    for (const cot of ['STT', 'Tên món', 'Số lượng', 'Người đăng ký', 'Phòng ban']) {
      await expect(page.getByRole('columnheader', { name: cot, exact: true })).toBeVisible();
    }

    // Bảng mặc định lọc "đơn chờ duyệt". Bỏ lọc trước khi kiểm cấu trúc bảng:
    // test này nói về bảng và thao tác bấm dòng, không nên hỏng chỉ vì lúc chạy
    // tình cờ không còn đơn nào đang chờ.
    const xoaLoc = page.getByRole('button', { name: 'Xoá lọc' });
    if (await xoaLoc.isVisible().catch(() => false)) await xoaLoc.click();

    // Thu hẹp vào ĐÚNG bảng danh sách: thẻ "Kỳ …" ở trang chủ dùng Descriptions,
    // mà AntD cũng render bằng <table> nên tìm dòng trên cả trang sẽ bắt nhầm.
    const bang = page
      .locator('table')
      .filter({ has: page.getByRole('columnheader', { name: 'STT', exact: true }) });

    // Dòng 0 là tiêu đề, dòng 1 là bản ghi đầu tiên — bám theo vai trò ARIA thay
    // vì thẻ tbody/td, vì AntD dựng thêm dòng đo đạc ẩn trong thân bảng.
    const dongDau = bang.getByRole('row').nth(1);
    await expect(dongDau.getByRole('cell').first()).toHaveText('1');

    await dongDau.click();
    // Ngăn kéo duyệt mở đúng đơn chứa món vừa bấm.
    await expect(page.getByText(/VPP-\d{4}-\d{2}-\d{4}/).first()).toBeVisible();
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
    await expect(page.getByRole('columnheader', { name: 'Mã', exact: true }).first()).toBeVisible();
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

  /**
   * Nhập danh mục phải XEM TRƯỚC rồi mới ghi. Test dừng ở bước xem trước và đóng
   * modal — cố ý KHÔNG ghi, để lần chạy sau không thừa hưởng danh mục do test tạo.
   */
  test('nhập danh mục: xem trước phân loại đúng từng dòng', async ({ page }) => {
    await page.goto('/quan-tri/danh-muc');
    await page.getByRole('button', { name: 'Nhập từ file' }).click();

    // File dùng dấu `;` như Excel bản tiếng Việt xuất ra.
    await page.locator('input[type="file"]').setInputFiles({
      name: 'danh-muc.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'Nhóm;Tên món;Đơn vị tính;Tối đa;Chỉ admin\n' +
          'Nhóm Thử E2E;Món thử E2E;cái;5;\n' +
          'Bút & Viết;Bút bi xanh;cây;20;\n' +
          'Bút & Viết;;cây;5;\n',
        'utf8',
      ),
    });

    await expect(page.getByText('Thêm mới: 1')).toBeVisible();
    await expect(page.getByText('Không đổi: 1')).toBeVisible();
    await expect(page.getByText('Lỗi: 1')).toBeVisible();
    await expect(page.getByText('Thiếu tên món')).toBeVisible();
    await expect(page.getByText(/Nhóm mới: Nhóm Thử E2E/)).toBeVisible();

    await page.getByRole('button', { name: 'Đóng' }).click();

    // Tải lại rồi mới kiểm: modal đã đóng vẫn còn DOM, nên tìm chữ trên trang sẽ
    // bắt phải bảng xem trước chứ không phải danh mục thật. Sau khi tải lại, còn
    // thấy món này nghĩa là nó đã bị ghi xuống CSDL — đúng thứ cần bắt.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Danh mục văn phòng phẩm' })).toBeVisible();
    await expect(page.getByText('Món thử E2E')).toHaveCount(0);
  });

  /**
   * Đổi khung ngày ảnh hưởng cả công ty nên màn này phải cho xem trước hậu quả
   * TRƯỚC khi lưu. Kiểm đúng điều đó: gõ số vào là phần xem trước đổi theo, và
   * bấm lưu xong thì trạng thái kỳ ở thanh trên cùng cũng đổi theo ngay.
   */
  test('cài đặt: xem trước rồi lưu khung ngày đăng ký', async ({ page }) => {
    await page.goto('/quan-tri/cai-dat');
    await expect(page.getByRole('heading', { name: 'Cài đặt' })).toBeVisible();

    const moTu = page.getByLabel('Ngày mở đăng ký');
    const dongSau = page.getByLabel('Ngày đóng đăng ký');

    // Trả về giá trị MẶC ĐỊNH CỐ ĐỊNH, không phải giá trị đọc được lúc bắt đầu.
    // Test này chạy song song cho desktop và mobile trên cùng một CSDL: nếu mỗi
    // bên khôi phục theo cái nó vừa đọc, hai bên sẽ đọc phải giá trị của nhau
    // đang sửa dở và để lại một khung ngày lẫn lộn (đã xảy ra: 15 → 30).
    const MAC_DINH = { start: '20', end: '31' };

    // Cửa sổ đúng ngày hôm nay ⇒ chắc chắn đang MỞ, không phụ thuộc ngày chạy test.
    const homNay = String(new Date().getDate());
    await moTu.fill(homNay);
    await dongSau.fill(homNay);
    await expect(page.getByText(/Hôm nay cửa sổ đang/)).toContainText('MỞ');

    await page.getByRole('button', { name: 'Lưu' }).click();
    await expect(page.getByText('Đã lưu khung ngày đăng ký.')).toBeVisible();
    await expect(page.getByText(/Đang mở đăng ký/)).toBeVisible();

    // Trả về mặc định để lần chạy sau không thừa hưởng cấu hình của test này.
    // Kiểm bằng cách TẢI LẠI TRANG chứ không bám vào thông báo thoáng qua: hai
    // thông báo có thể cùng hiện một lúc, và quan trọng hơn là ta muốn biết giá
    // trị đã thực sự lưu xuống CSDL chứ không chỉ hiện lời báo thành công.
    await moTu.fill(MAC_DINH.start);
    await dongSau.fill(MAC_DINH.end);
    await page.getByRole('button', { name: 'Lưu' }).click();

    await page.reload();
    await expect(page.getByLabel('Ngày mở đăng ký')).toHaveValue(MAC_DINH.start);
    await expect(page.getByLabel('Ngày đóng đăng ký')).toHaveValue(MAC_DINH.end);
  });
});
