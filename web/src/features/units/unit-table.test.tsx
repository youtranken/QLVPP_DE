import { describe, expect, it } from 'vitest';
import { renderWithI18n, screen } from '@/test/test-utils';
import { UnitTable } from './unit-table';
import type { AdminUnit } from './units.api';

const U = (code: string, name: string): AdminUnit => ({ code, name, name_en: null, sort_order: 10, active: true, in_use: false, item_count: 0 });
const noop = () => {};

function renderTable(busy: boolean) {
  return renderWithI18n(<UnitTable ordered={[U('cai', 'cái'), U('hop', 'hộp')]} busy={busy} sorting onMove={noop} onMoveTo={noop} onEdit={noop} onToggleActive={noop} onDelete={noop} />);
}

describe('UnitTable chế độ Sắp xếp', () => {
  it('đang lưu thứ tự → dòng không kéo được; không bận → kéo được', () => {
    renderTable(true);
    expect(screen.getByRole('row', { name: /cái/ })).not.toHaveAttribute('draggable');
    renderTable(false);
    expect(screen.getAllByRole('row', { name: /cái/ }).at(-1)).toHaveAttribute('draggable', 'true');
  });
});

describe('UnitTable: Sắp xếp khóa Sửa / Tạm ngưng / Xóa', () => {
  it('đang sắp xếp → Sửa, Tạm ngưng, Xóa khóa kèm lý do "Đang sắp xếp — Lưu thứ tự hoặc Hủy trước khi sửa"; thôi sắp xếp → bật', () => {
    const { unmount } = renderTable(false);
    for (const name of [/^Sửa cái/, /^Tạm ngưng cái/, /^Xóa cái/]) {
      const btn = screen.getByRole('button', { name });
      expect(btn).toBeDisabled();
      expect(btn).toHaveAccessibleDescription('Đang sắp xếp — Lưu thứ tự hoặc Hủy trước khi sửa');
    }
    unmount();
    renderWithI18n(<UnitTable ordered={[U('cai', 'cái')]} busy={false} sorting={false} onMove={noop} onMoveTo={noop} onEdit={noop} onToggleActive={noop} onDelete={noop} />);
    expect(screen.getByRole('button', { name: /^Sửa cái/ })).toBeEnabled();
  });
});

describe('UnitTable: ĐVT thiếu tên tiếng Anh', () => {
  it('name_en trống → nhắc "Thiếu tên EN"; có tên thì hiện tên, không nhắc', () => {
    renderWithI18n(<UnitTable ordered={[U('xap', 'xấp'), { ...U('cai', 'cái'), name_en: 'piece' }]} busy={false} sorting={false} onMove={noop} onMoveTo={noop} onEdit={noop} onToggleActive={noop} onDelete={noop} />);
    expect(screen.getAllByText('Thiếu tên EN')).toHaveLength(1);
    expect(screen.getByRole('row', { name: /xấp/ })).toHaveTextContent('Thiếu tên EN');
    expect(screen.getByRole('row', { name: /cái/ })).toHaveTextContent('piece');
  });
});
