import type { Page } from '@playwright/test';
import { psql } from './helpers';

// Kỳ quá khứ chỉ PW dùng: bản chốt và Hàng về của spec ghi vào kỳ này, không thay bản đã gửi của kỳ trước thật trên dev
export const PRIVATE_YM = '2000-01';
const PRIVATE_OPEN_YM = '2000-02';

// Gửi ADM/Hàng về làm việc trên kỳ hiện hành − 1: giả kỳ hiện hành để trang mở đúng kỳ riêng, mọi API khác vẫn thật
export async function openOnPrivatePeriod(page: Page) {
  await page.route('**/api/periods/current', async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    await route.fulfill({ response: res, json: { ...body, ym: PRIVATE_OPEN_YM, previous: body.previous ? { ...body.previous, ym: PRIVATE_YM } : null } });
  });
}

// report_snapshots có FK tới periods: xóa trước khi dọn kỳ seed (kỳ riêng nên xóa hết bản chốt của kỳ)
export const clearPrivateSnapshots = () => psql(`DELETE FROM report_snapshots WHERE period_ym = '${PRIVATE_YM}-01'`);
