import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { stubShellApi } from '@/test/admin-shell-stub';
import { CATEGORIES, PAPER, PEN, PENCIL } from '@/features/catalog/catalog-fixtures';
import { AN, BINH } from '@/features/directory/users-fixtures';

function open(width = 1280) {
  mockViewport(width);
  stubShellApi({
    '/api/admin/items': () => jsonResponse(200, [PAPER, PEN, PENCIL]),
    '/api/item-categories?all=1': () => jsonResponse(200, CATEGORIES),
    '/api/admin/users?limit=200': () => jsonResponse(200, { items: [AN, { ...BINH, fullName: 'Bùi Văn Tâm' }], next_cursor: null }),
  });
  renderApp(makeMe('admin'), '/admin/catalog');
}

const box = () => screen.getByRole('combobox', { name: 'Tìm nhanh' });
const location = () => screen.getByTestId('location').textContent! + screen.getByTestId('location-search').textContent!;

async function openWithKeys() {
  await userEvent.keyboard('{Control>}k{/Control}');
  return screen.findByRole('dialog', { name: 'Tìm nhanh' });
}

afterEach(() => vi.unstubAllGlobals());

describe('Tìm nhanh Ctrl K (TC-17)', () => {
  it('1280: ô "Tìm nhanh" nằm trên thanh trên, giữa đường dẫn và chuông, có gợi ý Ctrl K', async () => {
    open();
    const header = screen.getAllByRole('banner')[0];
    const trigger = within(header).getByRole('button', { name: 'Tìm nhanh' });
    expect(trigger).toHaveAttribute('aria-keyshortcuts', 'Control+K');
    expect(trigger).toHaveTextContent('Ctrl K');
    const crumb = within(header).getByRole('navigation', { name: 'Đường dẫn' });
    const bell = await within(header).findByRole('button', { name: /^Thông báo/ });
    expect(crumb.compareDocumentPosition(trigger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(trigger.compareDocumentPosition(bell) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Ctrl K mở hộp, ô tìm nhận focus; Esc đóng', async () => {
    open();
    await openWithKeys();
    expect(box()).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Tìm nhanh' })).toBeNull());
  });

  it('1 ký tự chưa tìm (nhắc gõ 2 ký tự), 2 ký tự thì có kết quả', async () => {
    open();
    await openWithKeys();
    await userEvent.type(box(), 'b');
    expect(screen.getByText('Gõ ít nhất 2 ký tự để tìm món, người hoặc trang.')).toBeInTheDocument();
    expect(screen.queryByRole('option')).toBeNull();
    await userEvent.type(box(), 'u');
    expect(await screen.findByRole('option', { name: /Bút bi xanh/ })).toBeInTheDocument();
  });

  it('gõ không dấu "but bi": nhóm Món / Người / Đi tới, món có nhóm và số trong tủ', async () => {
    open();
    await openWithKeys();
    await userEvent.type(box(), 'but bi');
    const items = await screen.findByRole('group', { name: 'Món' });
    expect(within(items).getByRole('option', { name: /Bút bi xanh/ })).toHaveTextContent('Bút & viết · tủ 10');
    expect(within(screen.getByRole('group', { name: 'Đi tới' })).getByRole('option', { name: 'Tủ / Kho › lọc "but bi"' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Người' })).toBeNull();
  });

  it('↑↓ đổi mục đang trỏ qua aria-activedescendant, Enter mở món ở Sản phẩm và đóng hộp', async () => {
    open();
    await openWithKeys();
    await userEvent.type(box(), 'but');
    const first = await screen.findByRole('option', { name: /Bút bi xanh/ });
    expect(box()).toHaveAttribute('aria-activedescendant', first.id);
    expect(first).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowDown}');
    const second = screen.getByRole('option', { name: /Bút chì 2B/ });
    expect(box()).toHaveAttribute('aria-activedescendant', second.id);
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    const options = screen.getAllByRole('option');
    expect(box()).toHaveAttribute('aria-activedescendant', options[options.length - 1].id);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    await waitFor(() => expect(location()).toBe('/admin/catalog?item=i-pencil'));
    expect(screen.queryByRole('dialog', { name: 'Tìm nhanh' })).toBeNull();
  });

  it('người: bấm "Bùi Văn Tâm" mở ngăn người đó ở Danh bạ', async () => {
    open();
    await openWithKeys();
    await userEvent.type(box(), 'bui van');
    await userEvent.click(await within(await screen.findByRole('group', { name: 'Người' })).findByRole('option', { name: /Bùi Văn Tâm/ }));
    await waitFor(() => expect(location()).toBe('/admin/users?person=u-binh'));
  });

  it('trang: gõ "danh ba" thì Đi tới Danh bạ', async () => {
    open();
    await openWithKeys();
    await userEvent.type(box(), 'danh ba');
    await userEvent.click(within(screen.getByRole('group', { name: 'Đi tới' })).getByRole('option', { name: /^Danh bạ/ }));
    await waitFor(() => expect(location()).toBe('/admin/users'));
  });

  it('kỳ: gõ "thang 11" thấy nhóm Kỳ "Kỳ tháng 11/2026" (kỳ đang mở), bấm thì mở Kỳ tháng đúng kỳ', async () => {
    open();
    await openWithKeys();
    await userEvent.type(box(), 'thang 11');
    const periods = await screen.findByRole('group', { name: 'Kỳ' });
    expect(within(periods).getAllByRole('option').map((o) => o.textContent)).toEqual(['Kỳ tháng 11/2026', 'Kỳ tháng 11/2025']);
    await userEvent.click(within(periods).getByRole('option', { name: 'Kỳ tháng 11/2026' }));
    await waitFor(() => expect(location()).toBe('/admin/month?ym=2026-11'));
  });

  it('kỳ: gõ "2026-10" ra "Kỳ tháng 10/2026"; kỳ 12 tháng trước (11/2025) có, 13 tháng trước (10/2025) không', async () => {
    open();
    await openWithKeys();
    await userEvent.type(box(), '2026-10');
    expect(await within(await screen.findByRole('group', { name: 'Kỳ' })).findByRole('option', { name: 'Kỳ tháng 10/2026' })).toBeInTheDocument();
    await userEvent.clear(box());
    await userEvent.type(box(), '2025');
    const periods = await screen.findByRole('group', { name: 'Kỳ' });
    expect(within(periods).getAllByRole('option').map((o) => o.textContent)).toEqual(['Kỳ tháng 12/2025', 'Kỳ tháng 11/2025']);
  });

  it('không khớp gì: nói rõ không thấy', async () => {
    open();
    await openWithKeys();
    await userEvent.type(box(), 'zzz');
    expect(await screen.findByText('Không thấy món, người hay trang nào khớp "zzz".')).toBeInTheDocument();
  });

  it('390: thanh trên có nút icon "Tìm nhanh" mở cùng hộp', async () => {
    open(390);
    const topbar = screen.getAllByRole('banner')[0];
    await userEvent.click(within(topbar).getByRole('button', { name: 'Tìm nhanh' }));
    expect(await screen.findByRole('dialog', { name: 'Tìm nhanh' })).toBeInTheDocument();
    expect(box()).toHaveFocus();
  });
});
