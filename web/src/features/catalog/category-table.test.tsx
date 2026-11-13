import { describe, expect, it } from 'vitest';
import { renderWithI18n, screen } from '@/test/test-utils';
import type { Category } from './catalog.api';
import { CategoryTable } from './category-table';

const C = (id: string, name: string): Category => ({ id, name, name_en: null, sort_order: 10, active: true });
const noop = () => {};

function renderTable(busy: boolean) {
  return renderWithI18n(
    <CategoryTable ordered={[C('a', 'Giấy'), C('b', 'Bút')]} counts={new Map()} countsReady busy={busy} sorting onMove={noop} onMoveTo={noop} onEdit={noop} onToggleActive={noop} onOpen={noop} />,
  );
}

describe('CategoryTable chế độ Sắp xếp', () => {
  it('đang lưu thứ tự → dòng không kéo được; không bận → kéo được', () => {
    renderTable(true);
    expect(screen.getByRole('row', { name: /Giấy/ })).not.toHaveAttribute('draggable');
    renderTable(false);
    expect(screen.getAllByRole('row', { name: /Giấy/ }).at(-1)).toHaveAttribute('draggable', 'true');
  });
});

describe('CategoryTable: nhóm thiếu tên tiếng Anh', () => {
  it('name_en trống → nhắc "Thiếu tên EN"; có tên thì hiện tên, không nhắc', () => {
    renderWithI18n(
      <CategoryTable ordered={[C('a', 'Giấy & sổ'), { ...C('b', 'Bút & viết'), name_en: 'Pens' }]} counts={new Map()} countsReady busy={false} sorting={false} onMove={noop} onMoveTo={noop} onEdit={noop} onToggleActive={noop} onOpen={noop} />,
    );
    expect(screen.getAllByText('Thiếu tên EN')).toHaveLength(1);
    expect(screen.getByRole('row', { name: /Giấy/ })).toHaveTextContent('Thiếu tên EN');
    expect(screen.getByRole('row', { name: /Bút/ })).toHaveTextContent('Pens');
  });
});
