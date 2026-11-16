import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { registrationRoute } from './registration-fixtures';
import { calledUrls, stubSummaryApi } from './summary-fixtures';

const openDialog = async (name = 'Nhân viên A') => {
  mockViewport(1280);
  renderApp(makeMe('admin'), '/admin/summary?ym=2026-11');
  const opener = await screen.findByRole('button', { name: `Xem phiếu của ${name}` });
  await userEvent.click(opener);
  return { opener, dialog: await screen.findByRole('dialog', { name: `Phiếu của ${name}` }) };
};

afterEach(() => vi.unstubAllGlobals());

describe('RegistrationDialog — phiếu một người, chỉ xem', () => {
  it('đầu hộp: kỳ · đang mở · team, "Lưu lúc 07/11 11:06 · 3 món · 22 đơn vị", dải "Chỉ xem" kèm giờ khóa', async () => {
    stubSummaryApi(registrationRoute());
    const { dialog } = await openDialog();
    expect(await within(dialog).findByText('Kỳ tháng 11 · đang mở · Team Test')).toBeInTheDocument();
    expect(within(dialog).getByText('Lưu lúc 07/11 11:06 · 3 món · 22 đơn vị')).toBeInTheDocument();
    expect(within(dialog).getByText(/^Chỉ xem\. Nhân viên còn sửa được tới 00:00 ngày 11\/11;/)).toBeInTheDocument();
  });

  it('team null → "Kỳ tháng 11 · đang mở · —"', async () => {
    stubSummaryApi(registrationRoute());
    const { dialog } = await openDialog('Nhân viên B');
    expect(await within(dialog).findByText('Kỳ tháng 11 · đang mở · —')).toBeInTheDocument();
  });

  it('hiện dòng món + số; món tạm ngưng có chữ "Tạm ngưng"; dòng ngoài danh mục ghi "chờ Adm D&E xem"; dòng bị từ chối không hiện; không ô sửa số', async () => {
    stubSummaryApi(registrationRoute());
    const { dialog } = await openDialog();
    expect(await within(dialog).findByText('Bút bi xanh')).toBeInTheDocument();
    const paused = within(dialog).getByText('Bút ghi đĩa').closest('li')!;
    expect(within(paused).getByText('Tạm ngưng')).toBeInTheDocument();
    expect(paused).toHaveTextContent('19');
    const custom = within(dialog).getByText('Test mon khac').closest('li')!;
    expect(custom).toHaveTextContent('Sản phẩm ngoài danh mục, chờ phê duyệt');
    expect(within(dialog).queryByText('Món bị từ chối')).toBeNull();
    expect(within(dialog).queryByRole('spinbutton')).toBeNull();
    expect(within(dialog).queryByRole('textbox')).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /Bớt|Thêm|Gỡ|Bỏ/ })).toBeNull();
  });

  it('"Người sau" sang người kế (gọi registrations/<id kế>); ở người đầu "Người trước" vô hiệu, ở người cuối "Người sau" vô hiệu', async () => {
    const f = stubSummaryApi(registrationRoute());
    const { dialog } = await openDialog();
    expect(within(dialog).getByRole('button', { name: 'Người trước' })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Người sau' }));
    const second = await screen.findByRole('dialog', { name: 'Phiếu của Nhân viên B' });
    expect(calledUrls(f)).toContain('/api/admin/periods/2026-11/registrations/q-b');
    await userEvent.click(within(second).getByRole('button', { name: 'Người sau' }));
    const last = await screen.findByRole('dialog', { name: 'Phiếu của Nhân viên C' });
    expect(within(last).getByRole('button', { name: 'Người sau' })).toBeDisabled();
    expect(within(last).getByRole('button', { name: 'Người trước' })).toBeEnabled();
  });

  it('chân hộp: "Đóng" là nút outline (không btn--primary); Esc đóng, focus về nút "Xem" đã mở', async () => {
    stubSummaryApi(registrationRoute());
    const { opener, dialog } = await openDialog();
    const footer = within(dialog).getAllByRole('button', { name: 'Đóng' }).find((b) => b.classList.contains('btn'))!;
    expect(footer).not.toHaveClass('btn--primary');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('bấm "Người sau" tới người cuối: nút vừa bấm vô hiệu nhưng focus không rơi ra ngoài, sang "Người trước"', async () => {
    stubSummaryApi(registrationRoute());
    const { dialog } = await openDialog('Nhân viên B');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Người sau' }));
    const last = await screen.findByRole('dialog', { name: 'Phiếu của Nhân viên C' });
    expect(within(last).getByRole('button', { name: 'Người sau' })).toBeDisabled();
    expect(within(last).getByRole('button', { name: 'Người trước' })).toHaveFocus();
  });

  it('đã bấm ‹ › sang người khác: Esc trả focus về "Xem" của người đang hiện, không phải người mở đầu', async () => {
    stubSummaryApi(registrationRoute());
    const { dialog } = await openDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Người sau' }));
    await screen.findByRole('dialog', { name: 'Phiếu của Nhân viên B' });
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Xem phiếu của Nhân viên B' })).toHaveFocus();
  });

  it('Xem phiếu là panel phủ từ phải như ngăn Giao (lớp ovp), dòng phụ kỳ · tổ nằm trong đầu panel; ˄ ˅ là nút ovp-icon (44 ở điện thoại)', async () => {
    stubSummaryApi(registrationRoute());
    const { dialog } = await openDialog();
    expect(dialog).toHaveClass('ovp');
    expect(within(dialog).getByText(/^Kỳ tháng 11/).closest('.ovp-head')).not.toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Người sau' })).toHaveClass('ovp-icon');
  });
});
