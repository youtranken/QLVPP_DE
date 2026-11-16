import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { stubShellApi } from '@/test/admin-shell-stub';
import type { ArrivalsPlan } from './arrivals.api';
import { plan, planRow } from './arrivals-fixtures';

export const PLAN_URL = '/api/admin/periods/2026-10/arrivals-plan';
export const RECEIPT_URL = '/api/admin/stock/receipts';
export const CUSTOM_URL = '/api/admin/periods/2026-10/custom-receipts';
export const PAST = { deadline: '2026-10-10T17:00:00.000Z' };
export const FUTURE = { deadline: '2999-10-10T17:00:00.000Z' };

export const CATEGORIES = [
  { id: 'c-but', name: 'Bút', name_en: 'Pens', sort_order: 1, active: true },
  { id: 'c-kep', name: 'Kẹp & dán', name_en: 'Clips', sort_order: 2, active: true },
];

export const adminItem = (id: string, name: string, stock: number, over: Record<string, unknown> = {}) => ({
  id, code: null, name, name_en: `${name} EN`, unit: 'cay', category_id: 'c-kep', image_file_id: null, stock_qty: stock, active: true, usable: true, ...over,
});

export const ITEMS = [adminItem('i-a', 'Bút bi', 2), adminItem('i-b', 'Kẹp giấy', 0), adminItem('i-9', 'Kẹp bướm', 4), adminItem('i-off', 'Món ngừng', 1, { active: false, usable: false })];

// Bút bi (nhóm Bút) còn 6, tủ 2; Kẹp giấy (nhóm Kẹp & dán) còn 10
export const PLAN = plan([
  planRow({ item_id: 'i-a', name: 'Bút bi', name_en: 'Ballpoint pen', code: 'B01', category_id: 'c-but', ordered: 10, received: 4, remaining: 6, stock_qty: 2 }),
  planRow({ item_id: 'i-b', name: 'Kẹp giấy', name_en: 'Paper clip', code: 'K14', category_id: 'c-kep', ordered: 10, received: 0, remaining: 10, stock_qty: 0 }),
]);

type Handler = (init: RequestInit | undefined, url: string) => Response;

export interface Stub {
  plan?: ArrivalsPlan | (() => ArrivalsPlan);
  summary?: { deadline: string };
  receipt?: (body: unknown) => Response;
  routes?: Record<string, Handler>;
}

export function stub(s: Stub = {}) {
  const planOf = () => (typeof s.plan === 'function' ? s.plan() : (s.plan ?? PLAN));
  const f = stubShellApi(
    {
      '/api/admin/periods/2026-10/summary': () => jsonResponse(200, { lines_pending_delivery: 0, ...(s.summary ?? PAST) }),
      [PLAN_URL]: () => jsonResponse(200, planOf()),
      '/api/admin/items': () => jsonResponse(200, ITEMS),
      '/api/item-categories?all=1': () => jsonResponse(200, CATEGORIES),
      [RECEIPT_URL]: (init) => (s.receipt ?? (() => jsonResponse(200, { items: [] })))(JSON.parse(String(init?.body))),
      [CUSTOM_URL]: () => jsonResponse(201, { received: 1 }),
    },
    () => jsonResponse(200, { items: [] }),
  );
  const base = f.getMockImplementation()!;
  f.mockImplementation((url: string, init?: RequestInit) => {
    const extra = Object.entries(s.routes ?? {}).find(([prefix]) => String(url).startsWith(prefix));
    return extra ? Promise.resolve(extra[1](init, String(url))) : base(url, init);
  });
  return f;
}

type Fetch = ReturnType<typeof stub>;
export const bodiesOf = (f: Fetch, url: string) => f.mock.calls.filter(([u]) => u === url).map(([, init]) => JSON.parse(String((init as RequestInit).body)));
export const callsTo = (f: Fetch, url: string, method?: string) =>
  f.mock.calls.filter(([u, init]) => String(u).startsWith(url) && (!method || (init as RequestInit | undefined)?.method === method)).map(([u]) => String(u));
export const box = (name: string) => screen.getByRole('spinbutton', { name: `Nhận đợt này: ${name}` }) as HTMLInputElement;
export async function type(el: HTMLElement, text: string) {
  await userEvent.clear(el);
  if (text) await userEvent.type(el, text);
}
// Nút trên thanh: "Nhận đủ hàng (n nhóm)" hoặc "Nhận hàng (n nhóm)" khi có nhóm không nhận đủ được
export const pickedBtn = () => screen.getByRole('button', { name: /^Nhận (đủ hàng|theo số đã nhập) \(\d+ nhóm\)$/ });
export const pickBox = (group: string) => screen.getByRole('checkbox', { name: `Chọn nhóm ${group}` });
// Nút đầu nhóm: chữ "Nhận đủ hàng"/"Nhận hàng", aria-label kèm tên nhóm
export const GROUP_BTN = /^Nhận (đủ hàng|theo số đã nhập): /;
export const groupBtn = (group: string) => within(screen.getByRole('rowgroup', { name: group })).getByRole('button', { name: GROUP_BTN });
// Tick mọi nhóm rồi bấm nút trên thanh: lưu mọi dòng còn nhận được
export async function receiveAll(groups = ['Bút', 'Kẹp & dán']) {
  for (const g of groups) await userEvent.click(pickBox(g));
  await userEvent.click(pickedBtn());
  await confirmReceive();
}

export async function open(path = '/admin/arrivals', width = 1280) {
  mockViewport(width);
  renderApp(makeMe('admin'), path);
  await screen.findByRole('heading', { level: 1, name: 'Nhận hàng kỳ tháng 10' });
}

// Nhận hàng và "NCC hết hàng" hỏi trước khi ghi kho
export async function confirmReceive() {
  await userEvent.click(within(await screen.findByRole('dialog', { name: /vào tủ\?$/ })).getByRole('button', { name: 'Ghi vào tủ' }));
}
export async function confirmAdmOut() {
  await userEvent.click(within(await screen.findByRole('dialog', { name: /^NCC hết hàng: / })).getByRole('button', { name: 'Đánh dấu NCC hết hàng' }));
}
