import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InfoTip } from './info-tip';

function setup() {
  render(
    <>
      <button type="button">ngoài</button>
      <InfoTip label="Cách tính Cần mua">
        <p>Cần mua = Chưa giao + Nợ − Tồn</p>
      </InfoTip>
    </>,
  );
  return screen.getByRole('button', { name: 'Cách tính Cần mua' });
}

describe('InfoTip', () => {
  it('đóng mặc định; bấm (chạm) mở nội dung có nhãn, aria-expanded true; bấm lại đóng', async () => {
    const btn = setup();
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Cần mua = Chưa giao + Nợ − Tồn')).toBeNull();
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog', { name: 'Cách tính Cần mua' })).toHaveTextContent('Cần mua = Chưa giao + Nợ − Tồn');
    await userEvent.click(btn);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('di chuột qua không mở (không chỉ-hover); Esc đóng và trả focus về nút; bấm ra ngoài đóng', async () => {
    const btn = setup();
    await userEvent.hover(btn);
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(btn);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(btn).toHaveFocus();
    await userEvent.click(btn);
    await userEvent.click(screen.getByRole('button', { name: 'ngoài' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('showLabel: nút hiện chữ nhãn (điện thoại), tên truy cập vẫn là nhãn', async () => {
    render(<InfoTip label="Cách tính" showLabel><p>x</p></InfoTip>);
    const btn = screen.getByRole('button', { name: 'Cách tính' });
    expect(btn).toHaveTextContent('Cách tính');
    await userEvent.click(btn);
    expect(screen.getByRole('dialog', { name: 'Cách tính' })).toHaveTextContent('x');
  });
});
