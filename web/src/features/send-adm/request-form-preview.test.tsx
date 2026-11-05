import { describe, expect, it } from 'vitest';
import { renderWithI18n as render, screen, within } from '@/test/test-utils';
import { RequestFormPreview, type PreviewRow } from './request-form-preview';

const ROWS: PreviewRow[] = [
  { key: 'a', code: 'B01', name: 'Bút bi', name_en: 'Pen', unit: 'cây', qty: 10 },
  { key: 'b', code: null, name: 'Tập', name_en: null, unit: 'cuốn', qty: 3 },
  { key: 'c', code: 'G11', name: 'Giấy A4', name_en: 'Paper A4', unit: 'ream', qty: 120 },
];
const BOXES = [
  { title: 'Chủ quản đơn vị', title_en: 'Head of Dept.', name: 'Ngô Văn Bảo' },
  { title: 'Người yêu cầu', title_en: 'Applicant', name: '' },
];

const sheet = () => screen.getByRole('region', { name: /Xem trước phiếu/ });

describe('RequestFormPreview', () => {
  it('header đúng 6 cột theo thứ tự sheet 1 Excel', () => {
    render(<RequestFormPreview rows={ROWS} signatureBoxes={BOXES} ym="2026-10" />);
    const heads = within(sheet()).getAllByRole('columnheader').map((h) => h.textContent?.replace(/\s+/g, ' ').trim());
    expect(heads).toEqual(['STT No.', 'Mã Code', 'Tên vật dụng', 'Item name', 'ĐVT Unit', 'SL Qty']);
  });

  it('STT liên tục 1..n, mã trống in —, tên EN trống để trống, số lượng đúng', () => {
    render(<RequestFormPreview rows={ROWS} signatureBoxes={BOXES} ym="2026-10" />);
    const body = within(sheet()).getAllByRole('row').slice(1);
    expect(body).toHaveLength(3);
    const cells = body.map((r) => within(r).getAllByRole('cell').map((c) => c.textContent));
    expect(cells).toEqual([
      ['1', 'B01', 'Bút bi', 'Pen', 'cây', '10'],
      ['2', '—', 'Tập', '', 'cuốn', '3'],
      ['3', 'G11', 'Giấy A4', 'Paper A4', 'ream', '120'],
    ]);
  });

  it('hai ô ký lấy từ signature_boxes; ô không tên có đường chấm', () => {
    render(<RequestFormPreview rows={ROWS} signatureBoxes={BOXES} ym="2026-10" />);
    const boxes = within(sheet()).getAllByRole('group').filter((g) => g.getAttribute('aria-label') !== 'Chữ ký');
    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toHaveTextContent('Chủ quản đơn vị');
    expect(boxes[0]).toHaveTextContent('Head of Dept.');
    expect(boxes[0]).toHaveTextContent('Ngô Văn Bảo');
    expect(boxes[1]).toHaveTextContent('Người yêu cầu');
    expect(within(boxes[1]).getByTestId('sign-dots')).toBeInTheDocument();
  });

  it('không có dòng: câu "Không có món cần đặt mua."', () => {
    render(<RequestFormPreview rows={[]} signatureBoxes={BOXES} ym="2026-10" />);
    expect(within(sheet()).getByText('Không có món cần đặt mua.')).toBeInTheDocument();
  });
});
