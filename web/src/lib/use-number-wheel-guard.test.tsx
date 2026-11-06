import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { useNumberWheelGuard } from './use-number-wheel-guard';

function Host() {
  useNumberWheelGuard();
  return (
    <>
      <input type="number" aria-label="n" defaultValue={5} />
      <input type="text" aria-label="t" />
    </>
  );
}

describe('useNumberWheelGuard — con lăn không đổi ô số', () => {
  it('lăn trên ô số đang focus → ô rời focus, số giữ nguyên', () => {
    const { getByLabelText } = render(<Host />);
    const n = getByLabelText('n') as HTMLInputElement;
    n.focus();
    fireEvent.wheel(n, { deltaY: -100 });
    expect(document.activeElement).not.toBe(n);
    expect(n.value).toBe('5');
  });

  it('ô chữ không bị ảnh hưởng', () => {
    const { getByLabelText } = render(<Host />);
    const t = getByLabelText('t');
    t.focus();
    fireEvent.wheel(t, { deltaY: -100 });
    expect(document.activeElement).toBe(t);
  });
});
