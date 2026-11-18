import { screen, userEvent } from '@/test/test-utils';

// ≤ 900 px phiếu nằm trong sheet: mở bằng nút "Xem phiếu (n món)" của thanh nổi, trả về dialog phiếu
export async function openPhoneCart(month = 11) {
  await userEvent.click(await screen.findByRole('button', { name: /^Xem phiếu \(/ }));
  return screen.findByRole('dialog', { name: `Phiếu tháng ${month}` });
}

