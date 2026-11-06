import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { snapshotRow } from '@/features/reports/reports-fixtures';
import { callsTo, itemRow, sendReport, sentData, sentState, setupSendAdm } from './send-adm-fixtures';

const PEN = itemRow({ key: 'kA', name: 'Bút bi', requested: 5, stock: 0 });
const TIP = 'Trong hộp in: chọn máy in, khổ A4; tắt \'Đầu trang và chân trang\'.';
const NO_APPENDIX = 'Không in kèm phụ lục';
const FORM = 'Phiếu đề xuất văn phòng phẩm';

async function open() {
  mockViewport(1280);
  renderApp(makeMe('admin'), '/admin/send-adm');
  await screen.findByRole('heading', { level: 1, name: 'Gửi ADM, kỳ tháng 10' });
}

// Giả Chrome: lúc hộp in mở thì vùng in đã có tờ trình ký
function spyPrint() {
  const sheets: (string | null)[] = [];
  const print = vi.spyOn(window, 'print').mockImplementation(() => {
    sheets.push(document.querySelector('body > [data-print-portal] h1')?.textContent ?? null);
    window.dispatchEvent(new Event('beforeprint'));
    window.dispatchEvent(new Event('afterprint'));
  });
  return { print, sheets };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Gửi ADM — In trình ký tại chỗ', () => {
  it('Lập phiếu: một lần bấm = 1 POST rồi 1 lần print với tờ đã chốt; URL không đổi, không mở tab; gợi ý hộp in và "Không in kèm phụ lục" cạnh nút', async () => {
    const f = setupSendAdm({ report: sendReport([PEN]) });
    const { print, sheets } = spyPrint();
    const tab = vi.spyOn(window, 'open');
    await open();
    expect(await screen.findByText(TIP)).toBeInTheDocument();
    expect(screen.getByText(NO_APPENDIX)).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'In trình ký' }));
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    expect(callsTo(f, 'POST', '/snapshots')).toHaveLength(1);
    expect(sheets).toEqual([FORM]);
    expect(tab).not.toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/admin\/send-adm$/);
    expect(await screen.findByText('Đã chốt bản 10:00 29/10. Cần in lại: mở Bản chốt.')).toBeInTheDocument();
    expect(document.querySelector('[data-print-portal]')).toBeNull();
  });

  it('bấm đúp → 1 POST, 1 print', async () => {
    const f = setupSendAdm({ report: sendReport([PEN]) });
    const { print } = spyPrint();
    // POST chưa trả lời lúc bấm lần hai, như bấm đúp thật
    let answer = () => {};
    const gate = new Promise<void>((r) => (answer = r));
    const inner = f.getMockImplementation()!;
    f.mockImplementation(async (url, init) => {
      if (init?.method === 'POST') await gate;
      return inner(url, init);
    });
    await open();
    const button = await screen.findByRole('button', { name: 'In trình ký' });
    fireEvent.click(button);
    fireEvent.click(button);
    answer();
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 50));
    expect(print).toHaveBeenCalledTimes(1);
    expect(callsTo(f, 'POST', '/snapshots')).toHaveLength(1);
  });

  it('đang chốt/chuẩn bị: nút "Đang chuẩn bị bản in…" vô hiệu, aria-busy', async () => {
    setupSendAdm({ report: sendReport([PEN]) });
    const base = vi.mocked(fetch);
    const inner = base.getMockImplementation()!;
    base.mockImplementation((url, init) => (init?.method === 'POST' ? new Promise<Response>(() => {}) : inner(url, init)));
    await open();
    await userEvent.click(await screen.findByRole('button', { name: 'In trình ký' }));
    const busy = await screen.findByRole('button', { name: 'Đang chuẩn bị bản in…' });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
  });

  it('Đã gửi: "In lại bản này" in tại chỗ từ bản có sẵn — 0 POST, 1 print, URL không đổi', async () => {
    const snap = sentData(sendReport([PEN]), { kA: 7 });
    const f = setupSendAdm({ report: sendReport([PEN]), state: sentState(snap) });
    const { print, sheets } = spyPrint();
    await open();
    await userEvent.click(await screen.findByRole('button', { name: 'In lại bản này' }));
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    expect(sheets).toEqual([FORM]);
    expect(callsTo(f, 'POST', '/api/')).toHaveLength(0);
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/admin\/send-adm$/);
    expect(screen.getByText(TIP)).toBeInTheDocument();
  });

  it('Bản chốt ở Gửi ADM: "In lại" mở trang in riêng cùng tab với ?from=send-adm', async () => {
    const snap = sentData(sendReport([PEN]), { kA: 7 });
    setupSendAdm({ report: sendReport([PEN]), state: sentState(snap) });
    const base = vi.mocked(fetch);
    const inner = base.getMockImplementation()!;
    base.mockImplementation(async (url, init) =>
      /\/api\/admin\/reports\/2026-10\/snapshots$/.test(String(url)) && !init?.method ? new Response(JSON.stringify({ items: [snapshotRow({ id: 'snap-p', kind: 'print' })] }), { status: 200, headers: { 'Content-Type': 'application/json' } }) : inner(url, init),
    );
    await open();
    const link = await within(await screen.findByRole('region', { name: 'Bản chốt' })).findByRole('link', { name: /^In lại bản lập/ });
    expect(link).toHaveAttribute('href', '/admin/reports/snapshots/snap-p/print?from=send-adm');
    expect(link).not.toHaveAttribute('target');
  });
});
