import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent, within } from '@/test/test-utils';
import { PAPER, PEN } from './catalog-fixtures';
import { draftFrom } from './item-draft';
import { StaffPreview } from './staff-preview';
import { renderDrawer, stubDrawerApi } from './item-drawer-fixtures';

afterEach(() => vi.unstubAllGlobals());

const region = () => screen.getByRole('region', { name: 'Nhân viên sẽ thấy' });

describe('StaffPreview', () => {
  it('hiện tên, ĐVT, tối đa/tháng, quy cách từ nháp', () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, [{ code: 'cay', name: 'cây', name_en: null, sort_order: 1, active: true }])));
    renderWithI18n(<StaffPreview draft={draftFrom(PEN, 20)} tone="g1" />);
    expect(within(region()).getByText('Bút bi xanh')).toBeInTheDocument();
    expect(within(region()).getByText(/hộp 20 cây/)).toBeInTheDocument();
    expect(within(region()).getByText(/tối đa 10\/tháng/)).toBeInTheDocument();
  });

  it('nháp trống → tên mẫu "Tên món", ảnh tạm không img', () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, [])));
    renderWithI18n(<StaffPreview draft={draftFrom(null, 20)} tone="g0" />);
    expect(within(region()).getByText('Tên món')).toBeInTheDocument();
    expect(region().querySelector('img')).toBeNull();
  });
});

describe('Ngăn kéo — xem trước phía nhân viên', () => {
  it('gõ tên và đổi tối đa → thẻ xem trước đổi theo, chưa lưu', async () => {
    const f = stubDrawerApi();
    renderDrawer({ item: PAPER });
    await userEvent.clear(screen.getByLabelText(/^Tên món/));
    await userEvent.type(screen.getByLabelText(/^Tên món/), 'Giấy A3');
    const max = screen.getByLabelText(/^Tối đa mỗi tháng/);
    await userEvent.clear(max);
    await userEvent.type(max, '7');
    expect(within(region()).getByText('Giấy A3')).toBeInTheDocument();
    expect(within(region()).getByText(/tối đa 7\/tháng/)).toBeInTheDocument();
    expect(f.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === 'PATCH')).toBe(false);
  });
});
