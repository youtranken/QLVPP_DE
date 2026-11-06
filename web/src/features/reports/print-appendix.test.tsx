import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@/test/test-utils';
import i18n from '@/lib/i18n';
import { ISSUE, PEN_KEY, SNAPSHOT_ID, TAPE_KEY, snapshotDataFixture, snapshotRow } from './reports-fixtures';
import type { SnapshotData } from './reports.api';
import { openPrint } from './print-test-stub';

afterEach(async () => {
  vi.unstubAllGlobals();
  await i18n.changeLanguage('vi');
});

const APPENDIX = 'Phụ lục · Chi tiết tháng 10/2026';

async function openAppendix(snap: SnapshotData = snapshotDataFixture(), snapshots = [snapshotRow({ id: SNAPSHOT_ID, kind: 'print' })]) {
  openPrint(snap, { query: '?appendix=1', snapshots });
  return screen.findByRole('region', { name: APPENDIX });
}

const cellsOf = (row: HTMLElement) => within(row).getAllByRole('cell').map((c) => c.textContent);
const tableIn = (scope: HTMLElement, name: string) => within(within(scope).getByRole('region', { name })).getByRole('table');

describe('Trang in · phụ lục (B6 cũ)', () => {
  it('đầu phụ lục: tên công ty, phòng, "Lập lúc hh:mm ngày dd/MM/yyyy bởi <tên>", "{n} phiếu · {m} món có đăng ký"', async () => {
    const app = await openAppendix();
    expect(within(app).getByText('Công ty Phú Mỹ Hưng')).toBeInTheDocument();
    expect(within(app).getByText('Phòng Công trình · Văn phòng phẩm')).toBeInTheDocument();
    expect(within(app).getByText('Lập lúc 09:30 ngày 28/10/2026 bởi Trần Thị Bình')).toBeInTheDocument();
    expect(within(app).getByText('2 phiếu · 3 món có đăng ký')).toBeInTheDocument();
  });

  it('người lập không có tên → hiện mã người dùng', async () => {
    const app = await openAppendix(snapshotDataFixture({ created_by: { sub: 'u-admin', name: null } }));
    expect(within(app).getByText('Lập lúc 09:30 ngày 28/10/2026 bởi u-admin')).toBeInTheDocument();
  });

  it('bản thứ hai của kỳ (danh sách mới trước) → "Bản chốt số 2 của kỳ"', async () => {
    const list = [snapshotRow({ id: 'newer' }), snapshotRow({ id: SNAPSHOT_ID }), snapshotRow({ id: 'older' })];
    const app = await openAppendix(snapshotDataFixture(), list);
    expect(await within(app).findByText('Bản chốt số 2 của kỳ')).toBeInTheDocument();
  });

  it('bản duy nhất của kỳ → "Bản chốt số 1 của kỳ"', async () => {
    const app = await openAppendix();
    expect(await within(app).findByText('Bản chốt số 1 của kỳ')).toBeInTheDocument();
  });

  it('mọi order_qty = need (kể cả khóa thiếu) → thêm "· Đặt mua mặc định"; một ô khác need → không có', async () => {
    const app = await openAppendix(snapshotDataFixture({ order_qty: { [PEN_KEY]: 10, [TAPE_KEY]: 5 } }));
    expect(await within(app).findByText('Bản chốt số 1 của kỳ · Đặt mua mặc định')).toBeInTheDocument();
  });

  it('bản chốt 0 hàng → chỉ "Bản chốt số 1 của kỳ", không "Đặt mua mặc định"', async () => {
    const app = await openAppendix(snapshotDataFixture({ byItem: [], custom: [], byDepartment: [], order_qty: {} }));
    expect(await within(app).findByText('Bản chốt số 1 của kỳ')).toBeInTheDocument();
    expect(within(app).queryByText(/Đặt mua mặc định/)).not.toBeInTheDocument();
  });

  it('một ô Đặt mua khác Cần mua → không có "Đặt mua mặc định"', async () => {
    const app = await openAppendix();
    expect(await within(app).findByText('Bản chốt số 1 của kỳ')).toBeInTheDocument();
    expect(within(app).queryByText(/Đặt mua mặc định/)).not.toBeInTheDocument();
  });

  it('Phần 1 phẳng theo thứ tự bản chốt: TT · Món · ĐVT · … · Đặt mua · Số người; hàng món không có Số người; nhóm "Ngoài danh mục (đã chấp nhận)" cuối; không nhóm theo danh mục sống', async () => {
    const app = await openAppendix();
    const table = tableIn(app, 'Phần 1 · Tổng hợp theo món');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['TT', 'Món', 'ĐVT', 'Chưa giao kỳ này', 'Nợ kỳ trước', 'Tồn', 'Cần mua', 'Đặt mua', 'Số người']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(cellsOf(rows[0])).toEqual(['1', 'Bút bi xanh', 'cây', '12', '3', '5', '10', '14', '']);
    expect(cellsOf(rows[1])).toEqual(['2', 'Hồ dán', 'lọ', '2', '0', '9', '0', '0', '']);
    expect(within(rows[2]).getByRole('rowheader')).toHaveTextContent('Ngoài danh mục (đã chấp nhận)');
    expect(cellsOf(rows[3])).toEqual(['3', 'Băng keo 2 mặt', 'cuộn', '4', '1', '—', '5', '5', '2']);
    expect(within(app).queryByText('Bút viết')).not.toBeInTheDocument();
    expect(within(app).getByText('Đề nghị mặc định = Chưa giao kỳ này + Nợ kỳ trước. Tủ chỉ để tham khảo, không trừ. Muốn bớt thì sửa ô Đề nghị.')).toBeInTheDocument();
  });

  it('Xuất lẻ trong kỳ: TT · Món · Người nhận · SL · Lý do · Ngày; không người nhận → "Dùng chung"', async () => {
    const app = await openAppendix(snapshotDataFixture({ issues: [ISSUE] }));
    const table = tableIn(app, 'Xuất lẻ trong kỳ');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['TT', 'Món', 'Người nhận', 'SL', 'Lý do', 'Ngày']);
    expect(cellsOf(within(table).getAllByRole('row')[1])).toEqual(['1', 'Giấy A4', 'Dùng chung', '2', 'Họp giao ban', '15/10/2026']);
  });

  it('không có xuất lẻ → ẩn bảng Xuất lẻ', async () => {
    const app = await openAppendix(snapshotDataFixture({ issues: [] }));
    expect(within(app).queryByRole('region', { name: 'Xuất lẻ trong kỳ' })).not.toBeInTheDocument();
  });

  it('Phần 2: Phòng ban · Người · Món đăng ký · Tổng; phòng ban null → "Chưa có phòng ban"', async () => {
    const app = await openAppendix();
    const table = tableIn(app, 'Phần 2 · Chi tiết theo phòng ban');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Phòng ban', 'Người', 'Món đăng ký', 'Tổng']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map(cellsOf)).toEqual([
      ['Tổ Giám sát', 'Phạm Văn Đức', 'Bút bi xanh 12', '12'],
      ['Chưa có phòng ban', 'Võ Thị Lan', 'Băng keo 2 mặt 4', '4'],
    ]);
  });

  it('bản chốt 0 dòng → câu trống của Phần 1 và Phần 2', async () => {
    const app = await openAppendix(snapshotDataFixture({ byItem: [], custom: [], byDepartment: [], order_qty: {} }));
    expect(within(app).getByText('Tháng này chưa có món nào được đăng ký.')).toBeInTheDocument();
    expect(within(app).getByText('Chưa có phiếu nào trong tháng này.')).toBeInTheDocument();
  });

  it('dòng cuối "VPP Công trình · Bản chốt lập 09:30 28/10/2026 — số liệu không đổi khi giao thêm"', async () => {
    const app = await openAppendix();
    expect(within(app).getByText('VPP Công trình · Bản chốt lập 09:30 28/10/2026 — số liệu không đổi khi giao thêm')).toBeInTheDocument();
  });

  it('giao diện tiếng Anh: phụ lục dùng name_en và tên ĐVT tiếng Anh đã chụp', async () => {
    await i18n.changeLanguage('en');
    openPrint(snapshotDataFixture(), { query: '?appendix=1' });
    const app = await screen.findByRole('region', { name: 'Appendix · Detail for 10/2026' });
    const table = tableIn(app, 'Part 1 · Summary by item');
    expect(cellsOf(within(table).getAllByRole('row')[1]).slice(1, 3)).toEqual(['Blue pen', 'stick']);
  });
});
