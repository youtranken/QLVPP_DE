import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithI18n as render, screen, userEvent } from '@/test/test-utils';
import { GroupChips } from './group-chips';

const GROUPS = [
  { id: 'g1', label: 'Bút' },
  { id: 'g2', label: 'Giấy' },
];

function Harness() {
  const [v, setV] = useState('all');
  return <GroupChips groups={GROUPS} counts={new Map([['g1', 3], ['g2', 1]])} value={v} onChange={setV} label="Nhóm món" allLabel="Tất cả" total={4} />;
}

describe('GroupChips', () => {
  it('role=group có nhãn; chip "Tất cả n" + mỗi nhóm có số; aria-pressed theo value', async () => {
    render(<Harness />);
    expect(screen.getByRole('group', { name: 'Nhóm món' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tất cả 4' })).toHaveAttribute('aria-pressed', 'true');
    const g1 = screen.getByRole('button', { name: 'Bút 3' });
    await userEvent.click(g1);
    expect(g1).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Tất cả 4' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Giấy 1' })).toHaveAttribute('aria-pressed', 'false');
  });
});
