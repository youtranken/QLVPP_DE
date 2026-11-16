import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDisabledReason } from './disabled-reason';

function Save({ reason }: { reason: string | null }) {
  const { describedBy, node } = useDisabledReason(reason);
  return (
    <div>
      <button type="button" disabled={reason !== null} aria-describedby={describedBy}>
        Lưu
      </button>
      {node}
    </div>
  );
}

describe('DisabledReason', () => {
  it('nút khóa có lý do → mô tả truy cập được là lý do, chữ thấy được', () => {
    render(<Save reason="Chưa có thay đổi" />);
    expect(screen.getByRole('button', { name: 'Lưu' })).toHaveAccessibleDescription('Chưa có thay đổi');
    expect(screen.getByText('Chưa có thay đổi')).toBeVisible();
  });

  it('reason null → không có dòng lý do, nút không có mô tả', () => {
    const { container } = render(<Save reason={null} />);
    expect(container.querySelector('.disabled-reason')).toBeNull();
    expect(screen.getByRole('button', { name: 'Lưu' })).not.toHaveAttribute('aria-describedby');
  });
});
