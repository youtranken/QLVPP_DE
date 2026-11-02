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
