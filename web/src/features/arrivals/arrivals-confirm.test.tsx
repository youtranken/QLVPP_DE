import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, waitFor, within } from '@/test/test-utils';
import { RECEIPT_URL, bodiesOf, box, callsTo, groupBtn, open, pickBox, pickedBtn, stub, type } from './arrivals-test-fixtures';

const ADM_URL = '/api/admin/periods/2026-10/adm-out/';
const rowOf = (name: string) => screen.getByText(name, { selector: 'b' }).closest('tr') as HTMLElement;
const shortCell = (name: string) => within(rowOf(name)).getAllByRole('cell')[4];

afterEach(() => vi.unstubAllGlobals());

describe('Nhận hàng — xác nhận trước khi ghi kho', () => {
  it('"Nhận đủ hàng (2 nhóm)" → hộp "Ghi 2 món vào tủ?" liệt kê số nhận; Hủy → không POST', async () => {
    const f = stub();
    await open();
    await screen.findByDisplayValue('6');
    await userEvent.click(pickBox('Bút'));
    await userEvent.click(pickBox('Kẹp & dán'));
    await userEvent.click(pickedBtn());
    const dialog = await screen.findByRole('dialog', { name: 'Ghi 2 món vào tủ?' });
    expect(dialog).toHaveTextContent('Bút bi: 6');
    expect(dialog).toHaveTextContent('Kẹp giấy: 10');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));
    expect(bodiesOf(f, RECEIPT_URL)).toHaveLength(0);
  });

  it('bấm đúp "Ghi vào tủ" → đúng một POST', async () => {
    const f = stub();
    await open();
    await screen.findByDisplayValue('6');
    await userEvent.click(groupBtn('Bút'));
    const dialog = await screen.findByRole('dialog', { name: 'Ghi 1 món vào tủ?' });
    await userEvent.dblClick(within(dialog).getByRole('button', { name: 'Ghi vào tủ' }));
    await waitFor(() => expect(bodiesOf(f, RECEIPT_URL)).toHaveLength(1));
    expect(bodiesOf(f, RECEIPT_URL)).toHaveLength(1);
  });

  it('"NCC hết hàng" → hỏi trước; Hủy → không PUT; đồng ý → PUT adm-out', async () => {
    const f = stub({ routes: { [ADM_URL]: () => new Response(null, { status: 204 }) } });
    await open();
    await screen.findByDisplayValue('6');
    await userEvent.click(screen.getByRole('button', { name: 'NCC hết hàng: Bút bi' }));
    let dialog = await screen.findByRole('dialog', { name: 'NCC hết hàng: Bút bi?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));
    expect(callsTo(f, ADM_URL, 'PUT')).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'NCC hết hàng: Bút bi' }));
    dialog = await screen.findByRole('dialog', { name: 'NCC hết hàng: Bút bi?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Đánh dấu NCC hết hàng' }));
    await waitFor(() => expect(callsTo(f, ADM_URL, 'PUT')).toEqual([`${ADM_URL}i-a`]));
  });

  it('gõ thiếu ở một dòng → nút nhóm đổi thành "Nhận theo số đã nhập"', async () => {
    stub();
    await open();
    await screen.findByDisplayValue('6');
    await type(box('Bút bi'), '3');
    expect(groupBtn('Bút')).toHaveTextContent('Nhận theo số đã nhập');
  });

  it('cột Còn thiếu cùng số với Tình trạng: chưa lưu, ô gõ sẵn 6 → Tình trạng "Thiếu 6", Còn thiếu "6"; gõ 4 → "2"', async () => {
    stub();
    await open();
    await screen.findByDisplayValue('6');
    expect(within(rowOf('Bút bi')).getByText('Thiếu 6')).toBeInTheDocument();
    expect(shortCell('Bút bi')).toHaveTextContent('6');
    await type(box('Bút bi'), '4');
    expect(shortCell('Bút bi')).toHaveTextContent('2');
  });
});
