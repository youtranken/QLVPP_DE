import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { renderApp } from '@/test/render-app';
import { mockViewport } from '@/test/viewport';
import { CONFIG, block, configInvalid, openConfig, putBodies, stubConfigApi } from './config-fixtures';

afterEach(() => vi.unstubAllGlobals());

const signer = () => screen.getAllByLabelText('Người ký')[0];
const SAVED_BLOCKS = ['Kỳ đăng ký', 'Ô ký trên phiếu đề xuất'];

async function retype(el: HTMLElement, value: string) {
  await userEvent.clear(el);
  await userEvent.type(el, value);
}

describe('Cấu hình · trang', () => {
  it('đầu trang có đúng một h1, mô tả nói một lần "Mỗi khối lưu riêng và ghi vào Nhật ký." (AD-55), 2 khối sửa được; không còn khối "Lưu thế nào", không lặp câu dưới mỗi nút Lưu', async () => {
    stubConfigApi();
    await openConfig();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Cấu hình' })).toBeInTheDocument();
    expect(screen.getByText('Tham số chung của app, áp dụng cho mọi người dùng. Mỗi khối lưu riêng và ghi vào Nhật ký.', { exact: true })).toBeInTheDocument();
    for (const name of SAVED_BLOCKS) expect(block(name)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Quyền truy cập' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Thay đổi gần đây' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Lưu thế nào' })).toBeNull();
    expect(screen.queryByText('Chỉ lưu khối này · ghi vào Nhật ký')).toBeNull();
    expect(screen.getAllByText(/ghi vào Nhật ký/)).toHaveLength(1);
  });

  it('nhãn ngắn: "Hạn đăng ký (ngày)", "Nhắc trước (ngày)", "Tối đa mỗi món"', async () => {
    stubConfigApi();
    await openConfig();
    for (const label of ['Hạn đăng ký (ngày)', 'Nhắc trước (ngày)', 'Tối đa mỗi món']) expect(screen.getByLabelText(label)).toBeInTheDocument();
  });

  it('đang tải cấu hình vẫn có đầu trang: đúng một h1 "Cấu hình"', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));
    mockViewport(1280);
    renderApp(makeMe('admin'), '/admin/config');
    expect(await screen.findByRole('heading', { level: 1, name: 'Cấu hình' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('lỗi tải cấu hình → "Không tải được dữ liệu — thử lại." + Thử lại', async () => {
    stubConfigApi(undefined, (url) => (url === '/api/admin/config' ? jsonResponse(500, { code: 'INTERNAL' }) : undefined));
    await openConfig().catch(() => undefined);
    expect(await screen.findByText('Không tải được dữ liệu — thử lại.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it('chưa sửa gì → cả 2 nút Lưu ghi "Chưa có thay đổi" và vô hiệu, không gửi PUT; đầu trang không có nhãn "khối chưa lưu"', async () => {
    const fetchMock = stubConfigApi();
    await openConfig();
    for (const name of SAVED_BLOCKS) {
      const button = within(block(name)).getByRole('button', { name: 'Chưa có thay đổi' });
      expect(button).toBeDisabled();
      await userEvent.click(button);
    }
    expect(putBodies(fetchMock)).toHaveLength(0);
    expect(screen.queryByText(/khối chưa lưu/)).toBeNull();
  });

  it('sửa một khối → chỉ nút khối đó thành "Lưu ô ký" (bật), khối khác vẫn "Chưa có thay đổi"; Hủy → về "Chưa có thay đổi"', async () => {
    stubConfigApi();
    await openConfig();
    await retype(signer(), 'chị Hoa');
    expect(within(block('Ô ký trên phiếu đề xuất')).getByRole('button', { name: 'Lưu ô ký' })).toBeEnabled();
    expect(within(block('Kỳ đăng ký')).getByRole('button', { name: 'Chưa có thay đổi' })).toBeDisabled();
    expect(screen.queryByText(/khối chưa lưu/)).toBeNull();
    await userEvent.click(within(block('Ô ký trên phiếu đề xuất')).getByRole('button', { name: 'Hủy' }));
    expect(signer()).toHaveValue(CONFIG.signature_boxes[0].name);
    expect(within(block('Ô ký trên phiếu đề xuất')).getByRole('button', { name: 'Chưa có thay đổi' })).toBeDisabled();
  });

  it('rời trang khi bẩn → hỏi "Bỏ thay đổi?" liệt kê khối; Ở lại thì ở lại', async () => {
    stubConfigApi();
    await openConfig();
    await retype(signer(), 'chị Hoa');
    await userEvent.click(screen.getByRole('link', { name: 'Nhật ký' }));
    const dialog = await screen.findByRole('dialog', { name: 'Bỏ thay đổi?' });
    expect(dialog).toHaveTextContent('Chưa lưu: Ô ký trên phiếu đề xuất.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ở lại' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/config');
    await userEvent.click(screen.getByRole('link', { name: 'Nhật ký' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Bỏ thay đổi' }));
    await vi.waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/admin/audit'));
  });

  it('khi bẩn, đóng tab bị chặn bằng beforeunload; sạch thì không', async () => {
    stubConfigApi();
    await openConfig();
    const clean = new Event('beforeunload', { cancelable: true });
    fireEvent(window, clean);
    expect(clean.defaultPrevented).toBe(false);
    await retype(signer(), 'chị Hoa');
    const dirty = new Event('beforeunload', { cancelable: true });
    fireEvent(window, dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });
});

describe('Cấu hình · không còn khối Liên hệ và công tắc sắp hết (A7)', () => {
  it('không có khối "Liên hệ Adm D&E và báo sắp hết hàng", ô liên hệ, công tắc báo sắp hết', async () => {
    stubConfigApi();
    await openConfig();
    expect(screen.queryByRole('form', { name: 'Liên hệ Adm D&E và báo sắp hết hàng' })).toBeNull();
    expect(screen.queryByLabelText('Tên và cách liên hệ Adm D&E')).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Báo Adm D&E khi món sắp hết' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Lưu liên hệ' })).toBeNull();
  });
});

describe('Cấu hình · kỳ đăng ký', () => {
  describe('ngày hạn nói rõ kỳ áp dụng', () => {
    const JAN = { ym: '2027-01', deadline: '2027-01-10T17:00:00.000Z', is_open: true, days_left: 5, previous: null, owed: [] };
    const LINE = 'Kỳ tháng 01 (đang mở) vẫn khóa 00:00 ngày 11/01. Áp dụng từ kỳ tháng 02: khóa 00:00 ngày 09/02.';
    const lastDay = () => screen.getByLabelText('Hạn đăng ký (ngày)');
    const openJan = (put?: Parameters<typeof stubConfigApi>[0]) =>
      stubConfigApi(put, (url) => (url === '/api/periods/current' ? jsonResponse(200, JAN) : undefined));

    it('kỳ mở 01, hạn 10 → 8: dòng sống dưới ô; Lưu → hộp xác nhận lặp đúng câu; đồng ý mới gửi', async () => {
      const fetchMock = openJan((body) => jsonResponse(200, { ...CONFIG, ...body }));
      await openConfig();
      expect(await screen.findByText('Kỳ tháng 01 (đang mở) vẫn khóa 00:00 ngày 11/01. Áp dụng từ kỳ tháng 02: khóa 00:00 ngày 11/02.')).toBeInTheDocument();
      await retype(lastDay(), '8');
      expect(within(block('Kỳ đăng ký')).getByText(LINE)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Lưu kỳ đăng ký' }));
      const dialog = await screen.findByRole('dialog', { name: 'Đổi hạn đăng ký?' });
      expect(within(dialog).getByText(LINE)).toBeInTheDocument();
      expect(putBodies(fetchMock)).toHaveLength(0);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));
      expect(putBodies(fetchMock)).toHaveLength(0);
      await userEvent.click(screen.getByRole('button', { name: 'Lưu kỳ đăng ký' }));
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lưu hạn mới' }));
      await vi.waitFor(() => expect(putBodies(fetchMock)).toEqual([{ registration_last_day: 8 }]));
    });

    it('chỉ đổi số ngày nhắc → không hỏi xác nhận hạn', async () => {
      const fetchMock = openJan((body) => jsonResponse(200, { ...CONFIG, ...body }));
      await openConfig();
      await retype(screen.getByLabelText('Nhắc trước (ngày)'), '2');
      await userEvent.click(screen.getByRole('button', { name: 'Lưu kỳ đăng ký' }));
      await vi.waitFor(() => expect(putBodies(fetchMock)).toEqual([{ reminder_days_left: 2 }]));
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('ô hạn ngoài 3–28 (2, 29) → nút Lưu khóa: không hỏi "Đổi hạn đăng ký?", không gửi', async () => {
      const fetchMock = openJan(() => jsonResponse(400, { code: 'VALIDATION', message: 'x', fields: ['registration_last_day'] }));
      await openConfig();
      for (const typed of ['2', '29']) {
        await retype(lastDay(), typed);
        expect(screen.getByRole('button', { name: 'Lưu kỳ đăng ký' })).toBeDisabled();
        expect(screen.queryByRole('dialog', { name: 'Đổi hạn đăng ký?' })).toBeNull();
      }
      expect(putBodies(fetchMock)).toHaveLength(0);
    });

    it('hạn 3 không lớn hơn ngày nhắc 3 → không hỏi "Đổi hạn đăng ký?", gửi thẳng để server báo lỗi ở ô; hạn 4 (> 3) → có hỏi', async () => {
      const fetchMock = openJan(() => configInvalid('registration_last_day'));
      await openConfig();
      await retype(lastDay(), '3');
      await userEvent.click(screen.getByRole('button', { name: 'Lưu kỳ đăng ký' }));
      await vi.waitFor(() => expect(putBodies(fetchMock)).toEqual([{ registration_last_day: 3 }]));
      expect(screen.queryByRole('dialog', { name: 'Đổi hạn đăng ký?' })).toBeNull();
      await retype(lastDay(), '4');
      await userEvent.click(screen.getByRole('button', { name: 'Lưu kỳ đăng ký' }));
      expect(await screen.findByRole('dialog', { name: 'Đổi hạn đăng ký?' })).toBeInTheDocument();
    });

    it('ô hạn đang sai (2) → chỉ còn nửa câu kỳ đang mở, không đoán ngày khóa kỳ sau', async () => {
      openJan();
      await openConfig();
      await retype(lastDay(), '2');
      expect(screen.getByText('Kỳ tháng 01 (đang mở) vẫn khóa 00:00 ngày 11/01.')).toBeInTheDocument();
      expect(screen.queryByText(/Áp dụng từ kỳ tháng 02/)).toBeNull();
    });
  });
});
