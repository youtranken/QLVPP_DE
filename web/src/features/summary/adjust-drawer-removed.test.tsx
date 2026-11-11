import { afterEach, describe, expect, it, vi } from 'vitest';
import { within } from '@/test/test-utils';
import { adminRequest } from './adjust-fixtures';
import { renderDrawer, saveButton, stubAdjust } from './adjust-render-fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('AdjustDrawer — phiếu Adm D&E đã bỏ hết dòng ở kỳ khóa', () => {
  it('0 dòng → "0 món — Adm D&E đã bỏ toàn bộ", chỉ đọc: không danh sách dòng, không lời nhắc giảm, Lưu vô hiệu', async () => {
    stubAdjust({ views: [adminRequest({ lines: [] })] });
    const { drawer } = await renderDrawer({ waitItems: false });
    expect(await within(drawer).findByText('0 món — Adm D&E đã bỏ toàn bộ')).toBeInTheDocument();
    expect(within(drawer).queryByRole('list')).toBeNull();
    expect(within(drawer).queryByText(/Chỉ giảm hoặc bỏ dòng/)).toBeNull();
    expect(saveButton(drawer)).toBeDisabled();
  });
});
