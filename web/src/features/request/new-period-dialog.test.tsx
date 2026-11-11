import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { lineView } from '@/test/fixtures-request';
import { mockViewport } from '@/test/viewport';
import { jsonResponse } from '@/test/test-utils';
import { PERIOD, PEN, view, stubRequestApi, markNewPeriodSeen } from '@/test/request-api-stub';
import type { CurrentPeriod } from './request.api';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const WITH_PREV: CurrentPeriod = { ...PERIOD, ym: '2026-12', deadline: '2026-12-10T17:00:00.000Z', previous: { ym: '2026-11', delivering: true } };
const L = (id: string, over = {}) => lineView({ id, custom_name: `Món ${id}`, custom_unit: 'cay', qty: 1, ...over });
const PREV = view({ id: 'r-0', period_ym: '2026-11', is_open: false, lines: [L('1', { delivered_qty: 1 }), L('2')] });
const TITLE = 'Giờ bạn đặt văn phòng phẩm cho tháng 12';

function open(over: Parameters<typeof stubRequestApi>[0] = {}) {
  mockViewport(1280);
  const api = stubRequestApi({ period: WITH_PREV, others: { '2026-11': PREV }, newPeriodSeen: false, ...over });
  renderApp(makeMe('member'), '/');
  return api;
}

describe('NewPeriodDialog', () => {
  it('chưa xem, chưa lưu → hiện tiêu đề + hạn chót; "Đăng ký tháng 12" đóng và ghi đã xem', async () => {
    open();
    const dlg = await screen.findByRole('dialog', { name: TITLE });
    expect(within(dlg).getByText('Kỳ tháng 11 đã chốt')).toBeInTheDocument();
    expect(within(dlg).getByText('23:59 ngày 10/12').tagName).toBe('B');
    // Tháng mới (ở tiêu đề và câu hạn) + giờ/ngày hạn tô màu cảnh báo
    expect([...dlg.querySelectorAll('.rq-np-hl')].map((n) => n.textContent)).toEqual(['tháng 12', 'tháng 12', '23:59 ngày 10/12']);
    expect(await within(dlg).findByText('Phiếu tháng 11: 2 món, đã nhận 1')).toBeInTheDocument();
    expect(within(dlg).getByRole('link', { name: 'Xem phiếu' })).toHaveAttribute('href', '/history/2026-11');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Đăng ký tháng 12' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: TITLE })).toBeNull());
    expect(localStorage.getItem('vpp_newperiod_seen:u-member:2026-12')).not.toBeNull();
  });

  it('Esc cũng đánh dấu đã xem, mount lại không hiện', async () => {
    open();
    await screen.findByRole('dialog', { name: TITLE });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: TITLE })).toBeNull());
    document.body.innerHTML = '';
    stubRequestApi({ period: WITH_PREV, others: { '2026-11': PREV }, newPeriodSeen: true });
    markNewPeriodSeen('u-member', '2026-12', true);
    renderApp(makeMe('member'), '/');
    await screen.findByRole('region', { name: 'Danh mục món' });
    expect(screen.queryByRole('dialog', { name: TITLE })).toBeNull();
  });

  it('đã xem kỳ đó → không hiện', async () => {
    open({ newPeriodSeen: true });
    await screen.findByRole('region', { name: 'Danh mục món' });
    expect(screen.queryByRole('dialog', { name: TITLE })).toBeNull();
  });

  it('không có phiếu kỳ trước (người mới / bỏ kỳ) → vẫn hiện một lần: chỉ tiêu đề + hạn chót, không dòng kỳ trước', async () => {
    open({ period: { ...WITH_PREV, previous: null } });
    const dlg = await screen.findByRole('dialog', { name: TITLE });
    expect(within(dlg).queryByText(/đã chốt/)).toBeNull();
    expect(within(dlg).getByText((_, el) => el?.tagName === 'P' && el.textContent === 'Hạn đăng ký tháng 12 là 23:59 ngày 10/12.')).toBeInTheDocument();
    expect(within(dlg).getByText('23:59 ngày 10/12').tagName).toBe('B');
    expect(within(dlg).queryByText(/^Phiếu tháng 11/)).toBeNull();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Đăng ký tháng 12' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: TITLE })).toBeNull());
    expect(localStorage.getItem('vpp_newperiod_seen:u-member:2026-12')).not.toBeNull();
  });

  it('không có phiếu tháng trước → không có dòng "Phiếu tháng 11"; không có from_ym → không có nút chép', async () => {
    open({ others: {} });
    const dlg = await screen.findByRole('dialog', { name: TITLE });
    await screen.findByRole('region', { name: 'Danh mục món', hidden: true });
    expect(within(dlg).queryByText(/^Phiếu tháng 11:/)).toBeNull();
    expect(within(dlg).queryByRole('button', { name: /Chép lại/ })).toBeNull();
  });

  it('bấm "Chép lại danh sách tháng 11" → đóng popup và chép vào giỏ', async () => {
    const api = open({
      copy: () =>
        jsonResponse(200, {
          from_ym: '2026-11',
          lines: [{ item_id: PEN.id, custom_name: null, custom_unit: null, qty: 3 }],
          skipped: [],
          capped: [],
          previously_accepted: [],
        }),
    });
    const dlg = await screen.findByRole('dialog', { name: TITLE });
    await userEvent.click(await within(dlg).findByRole('button', { name: 'Chép lại danh sách tháng 11' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: TITLE })).toBeNull());
    await waitFor(() => expect(api.fetchMock.mock.calls.some(([u]) => u === '/api/me/request/copy-previous')).toBe(true));
    expect(await screen.findAllByText('Bút bi xanh')).not.toHaveLength(0);
  });

  it('đã có phiếu lưu kỳ này → không hiện, và ghi đã xem', async () => {
    open({ request: view({ period_ym: '2026-12', lines: [L('9')] }) });
    await screen.findByRole('region', { name: 'Danh mục món' });
    expect(screen.queryByRole('dialog', { name: TITLE })).toBeNull();
    expect(localStorage.getItem('vpp_newperiod_seen:u-member:2026-12')).not.toBeNull();
  });
});
