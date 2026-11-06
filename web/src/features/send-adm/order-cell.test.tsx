import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, renderWithI18n, screen, userEvent } from '@/test/test-utils';
import { OrderCell } from './order-cell';
import { orderRow } from './send-adm-fixtures';
import type { OrderRow } from './send-adm-rows';

function Harness({ row, initial }: { row: OrderRow; initial?: string }) {
  const [draft, setDraft] = useState<string | undefined>(initial);
  return <OrderCell row={row} value={draft ?? String(row.suggested)} onEdit={setDraft} onReset={() => setDraft(undefined)} />;
}

const BASE = orderRow({ requested: 8, backlog: 2 });

describe('OrderCell — số đậm chỉ đọc, Sửa số, dòng xám, lệch số', () => {
  it('không có ô nhập tới khi bấm "Sửa số"; số gợi ý đậm 10, dòng xám "= 8 đăng ký + 2 nợ"', async () => {
    renderWithI18n(<Harness row={BASE} />);
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.getByText('10').tagName).toBe('B');
    expect(screen.getByText('= 8 đăng ký + 2 nợ')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sửa số' }));
    expect(screen.getByRole('spinbutton', { name: 'Đề nghị: Bút bi' })).toHaveValue(10);
  });

  it('dòng xám đầy đủ: ADM còn nợ (tháng 11) và người đã nghỉ', () => {
    renderWithI18n(<Harness row={orderRow({ requested: 8, backlog: 2, admOwed: 1, admMonths: ['2026-11'], left: 3 })} />);
    expect(screen.getByText('= 8 đăng ký + 2 nợ − 1 ADM còn nợ giao (tháng 11) · không tính 3 của người đã nghỉ')).toBeInTheDocument();
  });

  it('đã giao trước 2 của 8 → "6 đăng ký chưa giao"', () => {
    renderWithI18n(<Harness row={orderRow({ registered: 8, delivered: 2, requested: 6, backlog: 2 })} />);
    expect(screen.getByText('= 6 đăng ký chưa giao + 2 nợ')).toBeInTheDocument();
  });

  it('sửa 12 → nhãn "Đã sửa: 12 (gợi ý 10)"; "Về số gợi ý" bỏ nhãn và về 10', async () => {
    renderWithI18n(<Harness row={BASE} />);
    await userEvent.click(screen.getByRole('button', { name: 'Sửa số' }));
    const box = screen.getByRole('spinbutton');
    await userEvent.clear(box);
    await userEvent.type(box, '12');
    expect(screen.getByText('Đã sửa: 12 (gợi ý 10)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Về số gợi ý' }));
    expect(screen.queryByText(/Đã sửa/)).toBeNull();
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.getByText('10').tagName).toBe('B');
  });

  it('sửa về đúng số gợi ý → không nhãn "Đã sửa"', async () => {
    renderWithI18n(<Harness row={BASE} initial="10" />);
    expect(screen.queryByText(/Đã sửa/)).toBeNull();
  });

  it('lăn chuột trên ô: số không đổi và ô rời focus (không tăng/giảm bằng con lăn)', async () => {
    renderWithI18n(<Harness row={BASE} />);
    await userEvent.click(screen.getByRole('button', { name: 'Sửa số' }));
    const box = screen.getByRole('spinbutton');
    box.focus();
    fireEvent.wheel(box, { deltaY: -100 });
    expect(box).toHaveValue(10);
    expect(document.activeElement).not.toBe(box);
  });

  it('ô nhập là inputmode numeric', async () => {
    renderWithI18n(<Harness row={BASE} />);
    await userEvent.click(screen.getByRole('button', { name: 'Sửa số' }));
    expect(screen.getByRole('spinbutton')).toHaveAttribute('inputmode', 'numeric');
  });

  it.each([
    ['1', 'Đủ cho người đăng ký', 'ok'],
    ['0', 'Thiếu 1 — 1 cuộn sẽ không có để giao', 'short'],
    ['3', 'Dư 2 vào kho', 'surplus'],
  ])('W1: tủ 2, cần 3, đề nghị %s → "%s"', (order, text, tone) => {
    renderWithI18n(<Harness row={orderRow({ requested: 3, stock: 2, unit: 'cuon' })} initial={order} />);
    expect(screen.getByRole('status')).toHaveTextContent(text);
    expect(screen.getByRole('status')).toHaveAttribute('data-tone', tone);
  });

  it('W1: tủ 5, cần 3, đề nghị 0 → "Tủ đã đủ — vẫn dư 2 vào kho"', () => {
    renderWithI18n(<Harness row={orderRow({ requested: 3, stock: 5, unit: 'cuon' })} initial="0" />);
    expect(screen.getByRole('status')).toHaveTextContent('Tủ đã đủ — vẫn dư 2 vào kho');
  });

  it('W1 đổi ngay khi gõ, không đợi lưu', async () => {
    renderWithI18n(<Harness row={orderRow({ requested: 3, stock: 2, unit: 'cuon' })} />);
    expect(screen.getByRole('status')).toHaveTextContent('Dư 2 vào kho');
    await userEvent.click(screen.getByRole('button', { name: 'Sửa số' }));
    const box = screen.getByRole('spinbutton');
    await userEvent.clear(box);
    await userEvent.type(box, '1');
    expect(screen.getByRole('status')).toHaveTextContent('Đủ cho người đăng ký');
  });
});
