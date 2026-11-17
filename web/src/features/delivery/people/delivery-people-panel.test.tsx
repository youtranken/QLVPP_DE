import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { stubShellApi } from '@/test/admin-shell-stub';

import { PEOPLE_URL, open, search, stub } from './delivery-page-fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('DeliveryPeoplePage — panel và Người tiếp theo', () => {
  it('?person=u-b mở panel với nợ trước, tháng sau', async () => {
    stub();
    open('/admin/delivery?person=u-b');
    expect(await screen.findByRole('heading', { level: 2, name: 'Lê Thị Bình' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(expect.arrayContaining(['Nợ kỳ trước', 'Tháng 10']));
  });

  it('Giao ở panel A rồi "Người tiếp theo" chuyển sang người kế trong danh sách đang lọc (tab Chưa nhận: B)', async () => {
    stub();
    open('/admin/delivery?person=u-a');
    await screen.findByRole('heading', { level: 2, name: 'Nguyễn Văn An' });
    await userEvent.click(screen.getByRole('button', { name: 'Giao…' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Xác nhận giao' }));
    // Giao hết từ panel: đóng cả hộp lẫn panel
    await waitFor(() => expect(search()).not.toContain('person='));
    await userEvent.click(await screen.findByRole('button', { name: 'Người tiếp theo' }));
    expect(search()).toContain('person=u-b');
  });

  it('dòng tổng và nút "Giao…" nằm ở chân panel (khe footer dính đáy), không trong thân cuộn', async () => {
    stub();
    open('/admin/delivery?person=u-a');
    const dlg = await screen.findByRole('dialog', { name: 'Nguyễn Văn An' });
    const btn = within(dlg).getByRole('button', { name: 'Giao…' });
    expect(btn.closest('.ovp-foot')).not.toBeNull();
    expect(btn.closest('.ovp-body')).toBeNull();
    expect(dlg.querySelector('.ovp-foot .pp-sum')).toHaveTextContent(/^Giao \d+/);
    expect(dlg.querySelector('.pp-foot')).toBeNull();
  });

  it('390 px: bấm tên người cũng chọn người đó (nhãn bao tên)', async () => {
    stub();
    open('/admin/delivery', 390);
    const name = await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    await userEvent.click(name);
    expect(screen.getByRole('checkbox', { name: 'Chọn Nguyễn Văn An' })).toBeChecked();
  });

  it('?person= không có trong danh sách → không panel, không lỗi, tham số bị gỡ', async () => {
    stub();
    open('/admin/delivery?person=u-nobody&tab=all');
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    await waitFor(() => expect(search()).toBe('?tab=all'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each([390, 1280])('%i px: không còn cột bên; ⋯ → "Xem chi tiết" mở panel phủ có tên người, bộ đếm, ↓ sang người kế; đóng bỏ ?person=', async (width) => {
    stub();
    open('/admin/delivery', width);
    await userEvent.click(await screen.findByRole('button', { name: 'Thao tác cho Nguyễn Văn An' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Xem chi tiết' }));
    const dlg = await screen.findByRole('dialog', { name: 'Nguyễn Văn An' });
    expect(within(dlg).getByRole('button', { name: 'Giao…' })).toBeInTheDocument();
    expect(within(dlg).getByText('1/2')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Nguyễn Văn An', hidden: true })).toBeNull();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Người sau' }));
    expect(await screen.findByRole('dialog', { name: 'Lê Thị Bình' })).toBeInTheDocument();
    const close = 'Đóng';
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Lê Thị Bình' })).getByRole('button', { name: close }));
    await waitFor(() => expect(search()).not.toContain('person='));
  });

  it('"Giao…" trong panel mở hộp giao trên panel; giao có lỗi → hộp và panel đều ở lại', async () => {
    stub({ deliver: () => jsonResponse(409, { code: 'INSUFFICIENT_STOCK', available: 0 }) });
    open('/admin/delivery?person=u-a');
    const dlg = await screen.findByRole('dialog', { name: 'Nguyễn Văn An' });
    await userEvent.click(within(dlg).getByRole('button', { name: 'Giao…' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Giao cho Nguyễn Văn An?' })).getByRole('button', { name: 'Xác nhận giao' }));
    expect(await screen.findByRole('button', { name: 'Mở chi tiết người' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Nguyễn Văn An', hidden: true })).toBeInTheDocument();
    expect(search()).toContain('person=u-a');
  });
});

describe('DeliveryPeoplePage — kỳ chưa khóa và lỗi', () => {
  it('409 PERIOD_NOT_LOCKED → "Kỳ tháng 10 chưa khóa sổ — xem được từ 00:00 ngày 11/10.", không thẻ, không nút Giao', async () => {
    stub({ locked: false });
    open();
    expect(await screen.findByText('Kỳ tháng 10 chưa khóa sổ — xem được từ 00:00 ngày 11/10.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Giao/ })).toBeNull();
  });

  it('lỗi 500 khác → LoadError có nút Thử lại, không nhầm thành "chưa khóa sổ"', async () => {
    stubShellApi({ [PEOPLE_URL]: () => jsonResponse(500, null) });
    open();
    expect(await screen.findByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    expect(screen.queryByText(/chưa khóa sổ/)).toBeNull();
  });

  it('kỳ khóa nhưng không ai cần giao → câu rỗng cho cả kỳ', async () => {
    stub({ people: [] });
    open();
    expect(await screen.findByText('Tháng 10 chưa có ai cần nhận hàng.')).toBeInTheDocument();
  });
});

