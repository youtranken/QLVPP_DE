import { describe, expect, it } from 'vitest';
import { renderWithI18n, screen } from '@/test/test-utils';
import { DiffNote } from './diff-note';

const note = () => screen.getByRole('status');

describe('DiffNote — lệch số dưới ô Đề nghị (W1)', () => {
  it('d = 0 → tông ok "Đủ cho người đăng ký"', () => {
    renderWithI18n(<DiffNote d={0} order={1} unit="cuộn" />);
    expect(note()).toHaveTextContent('Đủ cho người đăng ký');
    expect(note()).toHaveAttribute('data-tone', 'ok');
  });

  it('d = −1 → tông short, có chữ thiếu kèm ĐVT', () => {
    renderWithI18n(<DiffNote d={-1} order={0} unit="cuộn" />);
    expect(note()).toHaveTextContent('Thiếu 1 — 1 cuộn sẽ không có để giao');
    expect(note()).toHaveAttribute('data-tone', 'short');
  });

  it('d = 2, đề nghị > 0 → tông surplus "Dư 2 vào kho"', () => {
    renderWithI18n(<DiffNote d={2} order={3} unit="cuộn" />);
    expect(note()).toHaveTextContent('Dư 2 vào kho');
    expect(note()).toHaveAttribute('data-tone', 'surplus');
  });

  it('d = 2, đề nghị 0 → "Tủ đã đủ — vẫn dư 2 vào kho"', () => {
    renderWithI18n(<DiffNote d={2} order={0} unit="cuộn" />);
    expect(note()).toHaveTextContent('Tủ đã đủ — vẫn dư 2 vào kho');
    expect(note()).toHaveAttribute('data-tone', 'surplus');
  });
});
