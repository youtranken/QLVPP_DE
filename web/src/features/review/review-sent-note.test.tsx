import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { PERIOD } from '@/test/request-api-stub';
import { reviewRow } from './review-fixtures';

const AT = '2026-11-11T15:12:00.000Z';
const W10B = 'Phiếu gửi NCC lúc 22:12 11/11 chưa có món này. Sau khi chấp nhận, vào Báo cáo & gửi NCC để làm bản mới và in lại, hoặc tự mua riêng.';

function mount(sent: { in_sent_snapshot: boolean | null; in_sent_snapshot_qty: number | null; in_sent_snapshot_at: string | null }) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/api/periods/current') return Promise.resolve(jsonResponse(200, PERIOD));
      if (url.startsWith('/api/admin/review')) return Promise.resolve(jsonResponse(200, { items: url.includes('status=pending') ? [reviewRow(sent)] : [] }));
      return Promise.resolve(jsonResponse(200, []));
    }),
  );
  mockViewport(1280);
  renderApp(makeMe('admin'), '/admin/review');
}

async function openDialog(button: string) {
  const card = await screen.findByRole('article', { name: 'Băng keo 2 mặt' });
  await userEvent.click(within(card).getByRole('button', { name: new RegExp(`^${button} —`) }));
  return screen.findByRole('dialog');
}

afterEach(() => vi.unstubAllGlobals());

describe('W10b — mua món chưa có trong phiếu gửi NCC', () => {
  it.each(['Mua lần này', 'Mua và thêm vào danh mục'])('in_sent_snapshot false → hộp "%s" có W10b và liên kết Mở Báo cáo & gửi NCC', async (button) => {
    mount({ in_sent_snapshot: false, in_sent_snapshot_qty: 0, in_sent_snapshot_at: AT });
    const dialog = await openDialog(button);
    expect(within(dialog).getByRole('note')).toHaveTextContent(W10B + ' Mở Báo cáo & gửi NCC');
    expect(within(dialog).getByRole('link', { name: 'Mở Báo cáo & gửi NCC' })).toHaveAttribute('href', '/admin/send-adm');
  });

  it.each([
    ['null (kỳ chưa có bản chốt có hàng)', null, null, null],
    ['true (món đã có trong bản)', true, 2, AT],
  ])('in_sent_snapshot %s → không cảnh báo', async (_label, inSnapshot, qty, at) => {
    mount({ in_sent_snapshot: inSnapshot as boolean | null, in_sent_snapshot_qty: qty as number | null, in_sent_snapshot_at: at as string | null });
    const dialog = await openDialog('Mua lần này');
    expect(within(dialog).queryByRole('note')).toBeNull();
  });

  it('hộp "Không mua" không hiện W10b', async () => {
    mount({ in_sent_snapshot: false, in_sent_snapshot_qty: 0, in_sent_snapshot_at: AT });
    const dialog = await openDialog('Không mua');
    expect(within(dialog).queryByRole('note')).toBeNull();
  });
});

describe('W10a — bỏ món đã tính vào phiếu gửi NCC', () => {
  it('"Không mua" khi in_sent_snapshot_qty > 0 → W10a có số và ĐVT, nút chính vẫn là "Không mua"', async () => {
    mount({ in_sent_snapshot: true, in_sent_snapshot_qty: 2, in_sent_snapshot_at: AT });
    const dialog = await openDialog('Không mua');
    expect(within(dialog).getByRole('note')).toHaveTextContent('Phiếu gửi NCC lúc 22:12 11/11 đã có món này (2 cái) — hàng về sẽ không có người nhận.');
    await userEvent.type(within(dialog).getByRole('textbox'), 'Đã có trong kho');
    expect(within(dialog).getByRole('button', { name: 'Không mua' })).toBeEnabled();
  });

  it.each([
    ['qty 0 (Đề nghị 0)', true, 0],
    ['null (chưa có bản)', null, null],
  ])('%s → không W10a', async (_label, inSnapshot, qty) => {
    mount({ in_sent_snapshot: inSnapshot as boolean | null, in_sent_snapshot_qty: qty as number | null, in_sent_snapshot_at: qty === null ? null : AT });
    const dialog = await openDialog('Không mua');
    expect(within(dialog).queryByRole('note')).toBeNull();
  });

  it('hộp "Mua lần này" không hiện W10a dù món đã có trong bản', async () => {
    mount({ in_sent_snapshot: true, in_sent_snapshot_qty: 2, in_sent_snapshot_at: AT });
    const dialog = await openDialog('Mua lần này');
    expect(within(dialog).queryByRole('note')).toBeNull();
  });
});
