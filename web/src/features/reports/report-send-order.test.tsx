import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, waitFor } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { callsTo, itemRow, sendReport, sentData, sentState, setupSendAdm, YM } from '@/features/send-adm/send-adm-fixtures';

const PEN = itemRow({ key: 'kA', name: 'Bút bi', requested: 5, need: 5 });
const PAPER = itemRow({ key: 'kB', name: 'Giấy A4', requested: 3, need: 3 });
const REPORT = sendReport([PEN, PAPER]);

function open(path = '/admin/reports') {
  mockViewport(1280);
  renderApp(makeMe('admin'), path);
}
const qtyBox = (name: string) => screen.findByRole('spinbutton', { name: `Đề nghị: ${name}` });
const snapshotPosts = (f: Parameters<typeof callsTo>[0]) => callsTo(f, 'POST', `/api/admin/reports/${YM}/snapshots`).filter((c) => c.url.endsWith('/snapshots'));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Ô Đề nghị: trần 1000 đúng luật server, lỗi gắn đúng ô, bấm chốt thì đưa con trỏ tới ô lỗi
describe('Báo cáo & gửi NCC: ô Đề nghị', () => {
  it('ô Đề nghị: gõ 1001 → lỗi "Tối đa 1.000" gắn ô; bấm Xem tổng kết không dựng bản mà đưa con trỏ về ô lỗi; 1000 hợp lệ; biên 0 hợp lệ', async () => {
    const f = setupSendAdm({ report: REPORT });
    open();
    const box = await qtyBox('Bút bi');
    await userEvent.clear(box);
    await userEvent.type(box, '1001');
    expect(await screen.findByText('Tối đa 1.000')).toBeInTheDocument();
    expect(box).toHaveAttribute('aria-invalid', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'In trình ký' }));
    await waitFor(() => expect(box).toHaveFocus());
    expect(callsTo(f, 'POST', `/api/admin/reports/${YM}/snapshots/preview`)).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Xuất Excel' }));
    expect(snapshotPosts(f)).toHaveLength(0);
    await userEvent.clear(box);
    await userEvent.type(box, '1000');
    expect(screen.queryByText('Tối đa 1.000')).toBeNull();
    expect(box).not.toHaveAttribute('aria-invalid');
    await userEvent.clear(box);
    await userEvent.type(box, '0');
    expect(screen.queryByText('Tối đa 1.000')).toBeNull();
  });

  it('số mặc định hệ thống > 1000: giữ nguyên số, không đỏ, ghi chú vàng "Vượt 1.000, kiểm lại", Xem tổng kết vẫn bấm được', async () => {
    const BIG = itemRow({ key: 'kC', name: 'Giấy photo', requested: 1200, need: 1200 });
    setupSendAdm({ report: sendReport([BIG]) });
    open();
    const box = await qtyBox('Giấy photo');
    expect(box).toHaveValue(1200);
    expect(box).not.toHaveAttribute('aria-invalid');
    expect(screen.getByText('Vượt 1.000, kiểm lại')).toBeInTheDocument();
    expect(screen.queryByText('Tối đa 1.000')).toBeNull();
    expect(screen.getByRole('button', { name: 'In trình ký' })).toBeEnabled();
  });

  it('ô Đề nghị là Stepper − / + (nút không nhận Tab), + ở 1000 tắt', async () => {
    setupSendAdm({ report: REPORT });
    open();
    const box = await qtyBox('Bút bi');
    const up = screen.getByRole('button', { name: 'Thêm Bút bi' });
    expect(up).toHaveAttribute('tabindex', '-1');
    await userEvent.click(up);
    expect(box).toHaveValue(6);
    await userEvent.clear(box);
    await userEvent.type(box, '1000');
    expect(up).toBeDisabled();
  });

  it('số từ bản đã gửi > 1000 khác mặc định sống (sẽ gửi đi) → đỏ kèm lý do, không gửi; sửa về 1000 thì hết đỏ', async () => {
    const f = setupSendAdm({ report: REPORT, state: sentState(sentData(REPORT, { kA: 1200, kB: 3 })) });
    open();
    const box = await qtyBox('Bút bi');
    expect(box).toHaveValue(1200);
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(box).toHaveAccessibleDescription('Bản đã gửi ghi số này; nay tối đa 1.000, sửa lại');
    expect(screen.queryByText('Vượt 1.000, kiểm lại')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'In trình ký' }));
    await waitFor(() => expect(box).toHaveFocus());
    expect(callsTo(f, 'POST', `/api/admin/reports/${YM}/snapshots/preview`)).toHaveLength(0);
    await userEvent.clear(box);
    await userEvent.type(box, '1000');
    expect(box).not.toHaveAttribute('aria-invalid');
  });

  it('ô lỗi bị bộ lọc "Chỉ món có Tổng cần" ẩn → bấm Xem tổng kết tắt lọc rồi đưa con trỏ tới ô lỗi', async () => {
    const f = setupSendAdm({ report: sendReport([PEN, itemRow({ key: 'kZ', name: 'Kẹp giấy', requested: 0, need: 0 })]) });
    open();
    const clip = await qtyBox('Kẹp giấy');
    await userEvent.clear(clip);
    await userEvent.type(clip, '1001');
    await userEvent.click(screen.getByRole('switch', { name: 'Chỉ món có Tổng cần' }));
    expect(screen.queryByRole('spinbutton', { name: 'Đề nghị: Kẹp giấy' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'In trình ký' }));
    expect(screen.getByRole('switch', { name: 'Chỉ món có Tổng cần' })).toHaveAttribute('aria-checked', 'false');
    await waitFor(() => expect(screen.getByRole('spinbutton', { name: 'Đề nghị: Kẹp giấy' })).toHaveFocus());
    expect(callsTo(f, 'POST', `/api/admin/reports/${YM}/snapshots/preview`)).toHaveLength(0);
    expect(snapshotPosts(f)).toHaveLength(0);
  });
});
