import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';
import { makeQueryClient } from '@/lib/api-client';
import { jsonResponse, render, screen, waitFor } from '@/test/test-utils';
import { PeriodLockGate } from './period-lock-gate';

const OPEN = { ym: '2026-11', deadline: '2026-11-10T17:00:00.000Z', is_open: true, days_left: 3, previous: null, owed: [] };
const LOCKED = { ym: '2026-10', deadline: '2026-10-10T17:00:00.000Z', is_open: false, registered: 6, headcount: 8, lines_pending_delivery: 0 };
const OPEN_SUMMARY = { ym: '2026-11', deadline: OPEN.deadline, is_open: true, registered: 3, headcount: 8, lines_pending_delivery: null };

function stub(summaryOf: (ym: string) => Response) {
  const f = vi.fn((url: string) => {
    if (url === '/api/periods/current') return Promise.resolve(jsonResponse(200, OPEN));
    const m = /periods\/(\d{4}-\d{2})\/summary/.exec(url);
    return Promise.resolve(m ? summaryOf(m[1]) : jsonResponse(404, null));
  });
  vi.stubGlobal('fetch', f);
  return f;
}

function mount(node: ReactNode) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>{node}</MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

const gate = () => (
  <PeriodLockGate ym="2026-10">
    <p>nội dung trang</p>
  </PeriodLockGate>
);

afterEach(async () => {
  vi.unstubAllGlobals();
  await i18n.changeLanguage('vi');
});

describe('PeriodLockGate — trang chỉ-kỳ-khóa', () => {
  it('kỳ khóa: không còn băng "đang mở, xem được từ" phía trên nội dung', async () => {
    stub((ym) => jsonResponse(200, ym === '2026-10' ? LOCKED : OPEN_SUMMARY));
    mount(gate());
    expect(await screen.findByText('nội dung trang')).toBeInTheDocument();
    expect(screen.queryByText(/đang mở, xem được từ/)).toBeNull();
    expect(screen.queryByRole('link', { name: /Xem đăng ký kỳ tháng/ })).toBeNull();
  });

  it('chưa có kỳ nào khóa (deadline null): khung trống "Chưa có kỳ nào chốt sổ" + tiến độ kỳ mở + nút, không nội dung trang', async () => {
    stub((ym) => jsonResponse(200, ym === '2026-10' ? { ...LOCKED, deadline: null } : OPEN_SUMMARY));
    mount(gate());
    expect(await screen.findByText('Chưa có kỳ nào chốt sổ')).toBeInTheDocument();
    expect(await screen.findByText('Kỳ tháng 11 đang nhận đăng ký (3/8 người). Hành chính làm việc từ 00:00 ngày 11/11.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem đăng ký kỳ tháng 11' })).toHaveAttribute('href', '/admin/month?ym=2026-11');
    expect(screen.queryByText('nội dung trang')).not.toBeInTheDocument();
  });

  it('tháng cũ hơn kỳ khóa mới nhất không có dòng periods (deadline null, server coi là đã khóa) → nội dung trang, không "Chưa có kỳ nào chốt sổ"', async () => {
    stub((ym) => jsonResponse(200, ym === '2026-09' ? { ...LOCKED, ym, deadline: null } : OPEN_SUMMARY));
    mount(
      <PeriodLockGate ym="2026-09">
        <p>nội dung trang</p>
      </PeriodLockGate>,
    );
    expect(await screen.findByText('nội dung trang')).toBeInTheDocument();
    expect(screen.queryByText('Chưa có kỳ nào chốt sổ')).not.toBeInTheDocument();
  });

  it('409 PERIOD_NOT_LOCKED: gọi đúng 1 lần (không retry), chữ lỗi bằng câu khóa sổ trong trang, không LoadError', async () => {
    const f = stub((ym) => (ym === '2026-10' ? jsonResponse(409, { code: 'PERIOD_NOT_LOCKED', ym, deadline: OPEN.deadline }) : jsonResponse(200, OPEN_SUMMARY)));
    mount(gate());
    expect(await screen.findByText('Kỳ tháng 10 chưa khóa sổ — xem được từ 00:00 ngày 11/11.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Thử lại' })).not.toBeInTheDocument());
    expect(f.mock.calls.filter(([u]) => String(u).includes('2026-10/summary'))).toHaveLength(1);
  });

  it('lỗi 500 khác: LoadError có Thử lại, không nhầm thành chưa khóa', async () => {
    stub((ym) => (ym === '2026-10' ? jsonResponse(500, null) : jsonResponse(200, OPEN_SUMMARY)));
    mount(gate());
    expect(await screen.findByRole('button', { name: 'Thử lại' }, { timeout: 3000 })).toBeInTheDocument();
  });
});
