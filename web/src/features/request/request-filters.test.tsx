import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { lineView } from '@/test/fixtures-request';
import { NOTE, facts, stubRequestApi, view } from '@/test/request-api-stub';
import { mockViewport } from '@/test/viewport';

const grid = () => screen.getByRole('region', { name: 'Danh mục món' });
// Tên mọi thẻ đang hiện (cả thẻ đã chọn, chỉ còn stepper); tên đầy đủ nằm ở title
const names = () => within(grid()).getAllByRole('article').map((a) => a.querySelector('[title]')!.getAttribute('title')!);

afterEach(() => {
  vi.unstubAllGlobals();
});

async function open(path = '/') {
  renderApp(makeMe('member'), path);
  await screen.findByRole('searchbox', { name: 'Tìm món' });
}

describe('RequestPage — thanh lọc', () => {
  it('1280 px: mặc định "Tất cả", không dòng đếm; gõ "giay" (không dấu) chỉ còn Giấy note vàng, "1 món khớp", q lên URL', async () => {
    mockViewport(1280);
    stubRequestApi();
    await open();
    expect(names()).toEqual(['Bút bi xanh', 'Giấy note vàng', 'Kẹp giấy']);
    expect(screen.queryByText(/món trong danh mục|món khớp/)).toBeNull();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm món' }), 'GIAY NOTE');
    await waitFor(() => expect(names()).toEqual(['Giấy note vàng']));
    await waitFor(() => expect(screen.getByTestId('location-search').textContent).toBe('?q=GIAY+NOTE'));
    expect(screen.getByText('1 món khớp')).toBeInTheDocument();
  });

  it('390 px (Review Focus 1): không có g trên URL → nhóm đầu, số thẻ ≤ số món của nhóm đó; chip "Tất cả" hiện đủ', async () => {
    mockViewport(390);
    stubRequestApi();
    await open();
    expect(names().length).toBeLessThanOrEqual(1);
    expect(names()).toEqual(['Bút bi xanh']);
    expect(screen.getByRole('button', { name: 'Bút & viết 1' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: /^Tất cả/ }));
    expect(names()).toHaveLength(3);
    expect(screen.getByTestId('location-search').textContent).toBe('?g=all');
  });

  it('nhãn nhóm trên thẻ chỉ hiện khi đang tìm (kết quả lẫn nhiều nhóm)', async () => {
    mockViewport(1280);
    stubRequestApi();
    await open();
    expect(within(grid()).queryByText('Bút & viết', { selector: '.rq-card-group' })).toBeNull();
    expect(within(grid()).queryByText('Giấy & sổ', { selector: '.rq-card-group' })).toBeNull();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm món' }), 'i');
    await waitFor(() => expect(within(grid()).getByText('Bút & viết', { selector: '.rq-card-group' })).toBeInTheDocument());
    expect(within(grid()).getByText('Giấy & sổ', { selector: '.rq-card-group' })).toBeInTheDocument();
  });

  it('món chưa có nhóm nằm trong chip "Khác"; không có chip "Chưa có nhóm"', async () => {
    mockViewport(1280);
    stubRequestApi();
    await open();
    expect(screen.queryByRole('button', { name: /^Chưa có nhóm/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Khác 1' }));
    await waitFor(() => expect(names()).toEqual(['Kẹp giấy']));
  });

  it('390 px: có từ khóa mà không có g → tìm trên mọi nhóm', async () => {
    mockViewport(390);
    stubRequestApi();
    await open('/?q=kep');
    expect(names()).toEqual(['Kẹp giấy']);
  });

  it('khóa cũ ?sort=az&picked=1 trên URL bị bỏ qua: đủ món, thứ tự theo nhóm, không ô sắp xếp, không nút "Đã chọn"', async () => {
    mockViewport(1280);
    stubRequestApi({ request: view({ lines: [lineView({ id: 'l-1', item_id: NOTE.id, item: facts(NOTE), qty: 1 })] }) });
    await open('/?sort=az&picked=1');
    expect(names()).toEqual(['Bút bi xanh', 'Giấy note vàng', 'Kẹp giấy']);
    expect(screen.queryByRole('combobox', { name: 'Sắp xếp' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Đã chọn/ })).toBeNull();
  });

  it('không có món khớp → thông báo rỗng; "Xóa lọc" xóa sạch khóa trên URL', async () => {
    mockViewport(1280);
    stubRequestApi();
    await open('/?g=c-1');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm món' }), 'khong co');
    expect(await screen.findByText('Không có món phù hợp')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Xóa lọc' }));
    await waitFor(() => expect(screen.getByTestId('location-search').textContent).toBe(''));
    expect(names()).toHaveLength(3);
  });

  it('thẻ cuối lưới "Không thấy món cần? Thêm tại đây" vẫn còn', async () => {
    mockViewport(1280);
    stubRequestApi();
    await open();
    expect(within(grid()).getByRole('button', { name: /Không thấy món cần\?/ })).toBeInTheDocument();
  });
});
