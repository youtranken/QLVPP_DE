import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { CONFIG, block, configInvalid, openConfig, putBodies, stubConfigApi } from './config-fixtures';

afterEach(() => vi.unstubAllGlobals());

const lastDay = () => screen.getByLabelText('Ngày hạn đăng ký hằng tháng');
const reminder = () => screen.getByLabelText('Nhắc người chưa có phiếu trước hạn');
const maxQty = () => screen.getByLabelText('Số lượng tối đa mặc định mỗi món');
const savePeriod = () => userEvent.click(screen.getByRole('button', { name: 'Lưu kỳ đăng ký' }));
const preview = () => screen.getByRole('list', { name: /^Xem trước lịch tháng/ });
const dayCell = (d: number) => within(preview()).getByText(String(d), { selector: '.cf-day__n' }).closest('li') as HTMLElement;

async function typeInto(el: HTMLElement, value: string) {
  await userEvent.clear(el);
  if (value) await userEvent.type(el, value);
}

describe('Cấu hình · khối Kỳ đăng ký', () => {
  it('hiện giá trị hiện tại và cảnh báo kỳ đang mở giữ hạn cũ kèm ngày khóa từ periods/current', async () => {
    stubConfigApi();
    await openConfig();
    expect(lastDay()).toHaveValue(10);
    expect(reminder()).toHaveValue(3);
    expect(maxQty()).toHaveValue(20);
    expect(
      await screen.findByText('Chỉ áp dụng cho kỳ tạo sau; kỳ đang mở giữ hạn cũ (tháng 11 vẫn khóa 00:00 ngày 11/11).'),
    ).toBeInTheDocument();
  });

  it('nút "Thêm một ngày" vô hiệu ở 28, "Lùi một ngày" vô hiệu ở 3; giữa hai mốc thì bật', async () => {
    stubConfigApi();
    await openConfig();
    const add = screen.getByRole('button', { name: 'Thêm một ngày' });
    const sub = screen.getByRole('button', { name: 'Lùi một ngày' });
    await typeInto(lastDay(), '27');
    expect(add).toBeEnabled();
    await userEvent.click(add);
    expect(lastDay()).toHaveValue(28);
    expect(add).toBeDisabled();
    await typeInto(lastDay(), '4');
    await userEvent.click(sub);
    expect(lastDay()).toHaveValue(3);
    expect(sub).toBeDisabled();
    expect(add).toBeEnabled();
  });

  it('nút ± ngày nhắc dừng ở 1 và 7', async () => {
    stubConfigApi();
    await openConfig();
    const up = screen.getByRole('button', { name: 'Tăng số ngày nhắc' });
    const down = screen.getByRole('button', { name: 'Giảm số ngày nhắc' });
    await typeInto(reminder(), '6');
    await userEvent.click(up);
    expect(reminder()).toHaveValue(7);
    expect(up).toBeDisabled();
    await typeInto(reminder(), '2');
    await userEvent.click(down);
    expect(reminder()).toHaveValue(1);
    expect(down).toBeDisabled();
  });

  it.each([
    ['2', 2],
    ['29', 29],
  ])('gõ tay %s vẫn gửi lên server; CONFIG_INVALID {field: registration_last_day} → "Nhập số từ 3 đến 28." tại ô', async (typed, sent) => {
    const fetchMock = stubConfigApi(() => configInvalid('registration_last_day'));
    await openConfig();
    await typeInto(lastDay(), typed);
    await savePeriod();
    await vi.waitFor(() => expect(lastDay()).toHaveAttribute('aria-invalid', 'true'));
    expect(lastDay()).toHaveAccessibleDescription('Nhập số từ 3 đến 28.');
    expect(putBodies(fetchMock)).toEqual([{ registration_last_day: sent }]);
  });

  it.each([3, 28])('ngày hạn %i gửi đúng một khóa và báo "Đã lưu." ở chân khối', async (day) => {
    const fetchMock = stubConfigApi((body) => jsonResponse(200, { ...CONFIG, ...body }));
    await openConfig();
    await typeInto(lastDay(), String(day));
    await savePeriod();
    expect(await within(block('Kỳ đăng ký')).findByText('Đã lưu.')).toBeInTheDocument();
    expect(putBodies(fetchMock)).toEqual([{ registration_last_day: day }]);
  });

  it('ô ngày hạn để trống → lỗi tại ô, không gửi', async () => {
    const fetchMock = stubConfigApi();
    await openConfig();
    await typeInto(lastDay(), '');
    await savePeriod();
    expect(lastDay()).toHaveAccessibleDescription('Nhập số từ 3 đến 28.');
    expect(putBodies(fetchMock)).toHaveLength(0);
  });

  it('server từ chối ngày hạn hợp lệ (đụng ngày nhắc) → báo lỗi ngày nhắc tại ô ngày hạn', async () => {
    stubConfigApi(() => configInvalid('registration_last_day'));
    await openConfig();
    await typeInto(lastDay(), '3');
    await savePeriod();
    await vi.waitFor(() => expect(lastDay()).toHaveAttribute('aria-invalid', 'true'));
    expect(lastDay()).toHaveAccessibleDescription('Ngày hạn phải lớn hơn số ngày nhắc người chưa có phiếu.');
  });

  it('CONFIG_INVALID {field: reminder_days_left} → lỗi tại ô ngày nhắc, ô ngày hạn không lỗi', async () => {
    const fetchMock = stubConfigApi(() => configInvalid('reminder_days_left'));
    await openConfig();
    await typeInto(reminder(), '8');
    await savePeriod();
    await vi.waitFor(() => expect(reminder()).toHaveAttribute('aria-invalid', 'true'));
    expect(reminder()).toHaveAccessibleDescription('Nhập số từ 1 đến 7, nhỏ hơn ngày hạn.');
    expect(lastDay()).not.toHaveAttribute('aria-invalid');
    expect(putBodies(fetchMock)).toEqual([{ reminder_days_left: 8 }]);
  });

  it('ngày nhắc gõ tay 0 vẫn gửi; CONFIG_INVALID {field: reminder_days_left} → lỗi tại ô', async () => {
    const fetchMock = stubConfigApi(() => configInvalid('reminder_days_left'));
    await openConfig();
    await typeInto(reminder(), '0');
    await savePeriod();
    await vi.waitFor(() => expect(reminder()).toHaveAttribute('aria-invalid', 'true'));
    expect(reminder()).toHaveAccessibleDescription('Nhập số từ 1 đến 7, nhỏ hơn ngày hạn.');
    expect(putBodies(fetchMock)).toEqual([{ reminder_days_left: 0 }]);
  });

  it.each([1, 7])('ngày nhắc %i gửi đi và báo "Đã lưu."', async (days) => {
    const fetchMock = stubConfigApi((body) => jsonResponse(200, { ...CONFIG, ...body }));
    await openConfig();
    await typeInto(reminder(), String(days));
    await savePeriod();
    expect(await within(block('Kỳ đăng ký')).findByText('Đã lưu.')).toBeInTheDocument();
    expect(putBodies(fetchMock)).toEqual([{ reminder_days_left: days }]);
  });

  it.each([
    ['1', 1],
    ['999', 999],
  ])('tối đa mặc định %s gửi đi', async (typed, sent) => {
    const fetchMock = stubConfigApi((body) => jsonResponse(200, { ...CONFIG, ...body }));
    await openConfig();
    await typeInto(maxQty(), typed);
    await savePeriod();
    await vi.waitFor(() => expect(putBodies(fetchMock)).toEqual([{ default_max_qty: sent }]));
  });

  it.each(['0', '1000'])('tối đa mặc định %s → lỗi tại ô, không gửi', async (typed) => {
    const fetchMock = stubConfigApi();
    await openConfig();
    await typeInto(maxQty(), typed);
    await savePeriod();
    expect(maxQty()).toHaveAccessibleDescription('Nhập số nguyên từ 1 đến 999.');
    expect(putBodies(fetchMock)).toHaveLength(0);
  });

  it('lịch xem trước tháng kế: mở đăng ký đến ngày hạn, ngày nhắc tô riêng, sau hạn là đã khóa', async () => {
    stubConfigApi();
    await openConfig();
    expect(preview()).toHaveAccessibleName('Xem trước lịch tháng 12/2026');
    expect(dayCell(1)).toHaveTextContent('Mở đăng ký');
    expect(dayCell(8)).toHaveTextContent('Nhắc người chưa có phiếu');
    expect(dayCell(10)).toHaveTextContent('Ngày hạn (đến 23:59)');
    expect(dayCell(11)).toHaveTextContent('Đã khóa · Hành chính giao hàng');
    await typeInto(reminder(), '1');
    expect(dayCell(10)).toHaveTextContent('Nhắc người chưa có phiếu');
    expect(dayCell(8)).not.toHaveTextContent('Nhắc người chưa có phiếu');
  });

  it.each(['2', '29'])('ngày hạn %s → thay lịch bằng "Nhập ngày hạn hợp lệ để xem trước"', async (typed) => {
    stubConfigApi();
    await openConfig();
    await typeInto(lastDay(), typed);
    expect(screen.queryByRole('list', { name: /^Xem trước lịch tháng/ })).toBeNull();
    expect(screen.getByText('Nhập ngày hạn hợp lệ để xem trước')).toBeInTheDocument();
    await typeInto(lastDay(), '3');
    expect(dayCell(3)).toHaveTextContent('Ngày hạn (đến 23:59)');
  });

  it('khối Kỳ đăng ký chỉ gửi khóa của khối, dù khối khác cũng đang sửa', async () => {
    const fetchMock = stubConfigApi((body) => jsonResponse(200, { ...CONFIG, ...body }));
    await openConfig();
    await typeInto(screen.getByLabelText('Tên và cách liên hệ Hành chính'), 'chị Hoa');
    await typeInto(reminder(), '4');
    await savePeriod();
    await vi.waitFor(() => expect(putBodies(fetchMock)).toEqual([{ reminder_days_left: 4 }]));
    expect(screen.getByLabelText('Tên và cách liên hệ Hành chính')).toHaveValue('chị Hoa');
  });
});
