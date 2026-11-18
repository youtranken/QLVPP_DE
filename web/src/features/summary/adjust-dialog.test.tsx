import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, userEvent, waitFor, within } from '@/test/test-utils';
import { lineView } from '@/test/fixtures-request';
import { ADMIN_ITEMS, adminRequest } from './adjust-fixtures';
import { putBody, putCalls, renderAdjust, stubAdjust } from './adjust-dialog-fixtures';

afterEach(() => vi.unstubAllGlobals());

const facts = (name: string, unit: string) => ({ name, name_en: null, unit, pack_note: null, image_file_id: null, active: true });

// Tháng 12: băng keo 10 (chưa giao), kệ mica ngoài DM đã chấp nhận 2, bút đã giao 4/10, giấy đang chờ duyệt
const DEC = adminRequest({
  period_ym: '2026-12',
  lines: [
    lineView({ id: 'l-tape', item_id: 'i-tape', item: facts('Băng keo si 3,5cm', 'cuon'), qty: 10 }),
    lineView({ id: 'l-shelf', custom_name: 'Kệ mica 3 tầng', custom_unit: 'cai', qty: 2, review_status: 'accepted' }),
    lineView({ id: 'l-pen', item_id: 'i-pen', item: facts('Bút bi xanh', 'cay'), qty: 10, delivered_qty: 4 }),
    lineView({ id: 'l-wait', custom_name: 'Giấy than', custom_unit: 'cai', qty: 1, review_status: 'pending' }),
  ],
});

const save = (d: HTMLElement) => within(d).getByRole('button', { name: /^Lưu \d+ thay đổi$|^Lưu thay đổi$/ });
const tick = (d: HTMLElement, name: string) => userEvent.click(within(d).getByRole('checkbox', { name: `Chọn ${name}` }));
const mode = (d: HTMLElement, name: string, label: 'Giảm còn' | 'Từ chối') =>
  userEvent.click(within(within(d).getByRole('radiogroup', { name: `Cách điều chỉnh ${name}` })).getByRole('radio', { name: label }));
const reason = (d: HTMLElement, label: string) => userEvent.click(within(within(d).getByRole('radiogroup', { name: 'Lý do' })).getByRole('radio', { name: label }));

describe('AdjustDialog — giảm / từ chối dòng, một lý do chip (G2)', () => {
  it('chưa tick dòng → nút Lưu khóa, lý do "Chọn ít nhất một dòng"', async () => {
    stubAdjust({ views: [DEC], items: ADMIN_ITEMS });
    const { dialog } = await renderAdjust();
    expect(save(dialog)).toBeDisabled();
    expect(save(dialog)).toHaveAccessibleDescription('Chọn ít nhất một dòng');
  });

  it('AD-14 chân ngăn: chữ "Chọn ít nhất một dòng" đứng trước nút Hủy và nút Lưu (nút chính sát mép phải)', async () => {
    stubAdjust({ views: [DEC], items: ADMIN_ITEMS });
    const { dialog } = await renderAdjust();
    const reasonEl = within(dialog).getByText('Chọn ít nhất một dòng');
    const cancel = within(dialog).getByRole('button', { name: 'Hủy' });
    expect(reasonEl.compareDocumentPosition(cancel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(reasonEl.compareDocumentPosition(save(dialog)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('tick dòng, chưa chọn lý do → khóa, "Chọn lý do"; chip: Hết hàng · Số lượng quá nhiều · Không mua được · Khác', async () => {
    stubAdjust({ views: [DEC] });
    const { dialog } = await renderAdjust();
    await tick(dialog, 'Kệ mica 3 tầng');
    expect(save(dialog)).toHaveAccessibleDescription('Chọn lý do');
    expect(within(within(dialog).getByRole('radiogroup', { name: 'Lý do' })).getAllByRole('radio').map((r) => r.closest('label')?.textContent)).toEqual([
      'Hết hàng',
      'Số lượng quá nhiều',
      'Không mua được',
      'Khác',
    ]);
  });

  it('dòng chờ duyệt không tick được (duyệt ở Xem phiếu); dòng đã giao 4/10: "Giảm còn" từ 4, Từ chối = giữ 4', async () => {
    stubAdjust({ views: [DEC] });
    const { dialog } = await renderAdjust();
    expect(within(dialog).queryByRole('checkbox', { name: 'Chọn Giấy than' })).toBeNull();
    await tick(dialog, 'Bút bi xanh');
    const box = within(dialog).getByRole('spinbutton', { name: 'Giảm còn: Bút bi xanh' });
    expect(box).toHaveAttribute('min', '4');
    expect(box).toHaveAttribute('max', '9');
  });

  it('chọn Khác chưa gõ → lỗi gắn ô Ghi thêm, Lưu khóa; gõ 3 chữ → hết lỗi', async () => {
    stubAdjust({ views: [DEC] });
    const { dialog } = await renderAdjust();
    await tick(dialog, 'Kệ mica 3 tầng');
    await reason(dialog, 'Khác');
    const note = within(dialog).getByLabelText(/^Ghi thêm/);
    expect(note).toHaveAttribute('aria-invalid', 'true');
    expect(note).toHaveAccessibleDescription('Chọn Khác thì cần ghi lý do.');
    expect(save(dialog)).toBeDisabled();
    await userEvent.type(note, 'abc');
    expect(note).not.toHaveAttribute('aria-invalid');
    expect(save(dialog)).toBeEnabled();
  });

  it('câu xem trước = "Adm D&E giảm Băng keo si 3,5cm 10 → 5 cuộn, từ chối Kệ mica 3 tầng (tháng 12): Số lượng quá nhiều."; Lưu gửi mọi dòng, dòng chọn có lý do', async () => {
    const f = stubAdjust({ views: [DEC], put: () => jsonResponse(200, { request: DEC }) });
    const { dialog, onClose } = await renderAdjust();
    await tick(dialog, 'Băng keo si 3,5cm');
    const qty = within(dialog).getByRole('spinbutton', { name: 'Giảm còn: Băng keo si 3,5cm' });
    await userEvent.clear(qty);
    await userEvent.type(qty, '5');
    await tick(dialog, 'Kệ mica 3 tầng');
    await mode(dialog, 'Kệ mica 3 tầng', 'Từ chối');
    await reason(dialog, 'Số lượng quá nhiều');
    expect(within(dialog).getByText('Adm D&E giảm Băng keo si 3,5cm 10 → 5 cuộn, từ chối Kệ mica 3 tầng (tháng 12): Số lượng quá nhiều.')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu 2 thay đổi' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(putCalls(f)).toHaveLength(1);
    expect(putBody(f)).toEqual({
      expected_updated_at: DEC.updated_at,
      lines: [
        { id: 'l-tape', qty: 5, expected_qty: 10, reason_code: 'over_quota' },
        { id: 'l-shelf', qty: 0, expected_qty: 2, reason_code: 'over_quota' },
        { id: 'l-pen', qty: 10, expected_qty: 10 },
        { id: 'l-wait', qty: 1, expected_qty: 1 },
      ],
    });
  });

  it('Từ chối dòng đã giao 4/10 → gửi qty 4 (giữ phần đã giao); "Giảm còn" 3 (dưới số đã giao) → lỗi gắn ô, Lưu khóa', async () => {
    const f = stubAdjust({ views: [DEC], put: () => jsonResponse(200, { request: DEC }) });
    const { dialog } = await renderAdjust();
    await tick(dialog, 'Bút bi xanh');
    const qty = within(dialog).getByRole('spinbutton', { name: 'Giảm còn: Bút bi xanh' });
    await userEvent.clear(qty);
    await userEvent.type(qty, '3');
    expect(qty).toHaveAttribute('aria-invalid', 'true');
    await reason(dialog, 'Hết hàng');
    expect(save(dialog)).toBeDisabled();
    await mode(dialog, 'Bút bi xanh', 'Từ chối');
    await userEvent.click(save(dialog));
    await waitFor(() => expect(putCalls(f)).toHaveLength(1));
    expect(putBody(f).lines[2]).toEqual({ id: 'l-pen', qty: 4, expected_qty: 10, reason_code: 'adm_out_of_stock' });
  });

  it('server 409 STALE_UPDATE → báo "Phiếu vừa được người khác sửa" + nút tải bản mới, không đóng', async () => {
    stubAdjust({ views: [DEC], put: () => jsonResponse(409, { code: 'STALE_UPDATE', message: 'x' }) });
    const { dialog, onClose } = await renderAdjust();
    await tick(dialog, 'Kệ mica 3 tầng');
    await reason(dialog, 'Không mua được');
    await userEvent.click(save(dialog));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Phiếu vừa được người khác sửa — tải lại.');
    expect(within(dialog).getByRole('button', { name: 'Tải bản mới nhất' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('mở từ ?left=1, chủ phiếu đã nghỉ → chip "Người đã nghỉ" chọn sẵn; chủ phiếu còn làm → không chọn sẵn', async () => {
    stubAdjust({ views: [{ ...DEC, user_status: 'locked' }] });
    const { dialog } = await renderAdjust({ preset: 'user_left' });
    expect(within(within(dialog).getByRole('radiogroup', { name: 'Lý do' })).getByRole('radio', { name: 'Người đã nghỉ' })).toBeChecked();
  });

  it('W11: kỳ đã gửi NCC (22:12 05/11) → dòng chọn giảm 10 → 8 báo "hàng về dư 2 cuộn vào kho"; chưa gửi → không báo', async () => {
    const sent = { state: 'sent', no_order_at: null, no_order_by_name: null, changed_after: false, changed_at: null, sent: { id: 's-1', kind: 'print', created_at: '2026-11-05T15:12:00.000Z', items_count: 3, units_total: 15, replaces: null, data: {} } };
    stubAdjust({ views: [DEC], send: sent });
    const { dialog } = await renderAdjust();
    await tick(dialog, 'Băng keo si 3,5cm');
    const qty = within(dialog).getByRole('spinbutton', { name: 'Giảm còn: Băng keo si 3,5cm' });
    await userEvent.clear(qty);
    await userEvent.type(qty, '8');
    expect(await within(dialog).findByText(/^Phiếu gửi NCC lúc 22:12 05\/11 đã tính số cũ — giảm bây giờ thì hàng về dư 2 cuộn vào kho\.$/)).toBeInTheDocument();
  });
});

