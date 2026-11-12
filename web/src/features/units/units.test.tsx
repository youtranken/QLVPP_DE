import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, jsonResponse, renderHook, screen, waitFor, optionLabels } from '@/test/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { render } from '@testing-library/react';
import i18n from '@/lib/i18n';
import { UnitSelect } from './unit-select';
import { useUnitName, type Unit } from './units.api';

const unit = (code: string, name: string, over: Partial<Unit> = {}): Unit => ({
  code,
  name,
  name_en: null,
  sort_order: 0,
  active: true,
  ...over,
});

function withServer(units: Unit[]) {
  const fetchMock = vi.fn((url: string) =>
    Promise.resolve(url === '/api/units' ? jsonResponse(200, units) : jsonResponse(500, {})),
  );
  vi.stubGlobal('fetch', fetchMock);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </QueryClientProvider>
  );
  return { fetchMock, wrapper };
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await act(() => i18n.changeLanguage('vi'));
});

describe('UnitSelect', () => {
  it('chỉ hiện ĐVT server trả (đang dùng) theo đúng thứ tự API; chưa chọn thì nút hiện "Chọn ĐVT"', async () => {
    const { wrapper } = withServer([unit('thung', 'thùng'), unit('cai', 'cái'), unit('goi', 'gói')]);
    render(<UnitSelect aria-label="ĐVT" value="" onValueChange={() => undefined} />, { wrapper });
    const select = screen.getByRole('combobox', { name: 'ĐVT' });
    // Chưa chọn: nút hiện chữ gợi ý "Chọn ĐVT" (không phải một mục trong danh sách)
    expect(select).toHaveTextContent(i18n.t('catalog.form.unitPlaceholder'));
    await waitFor(async () => expect(await optionLabels(select)).toEqual(['thùng', 'cái', 'gói']));
  });

  it('dòng/món cũ đang giữ ĐVT đã ngừng: ô chọn vẫn giữ lựa chọn đó (hiện tên) ở cuối, không có ĐVT ngừng khác', async () => {
    const { wrapper } = withServer([unit('cai', 'cái'), unit('thung', 'thùng', { active: false }), unit('bao', 'bao', { active: false })]);
    render(<UnitSelect aria-label="ĐVT" value="thung" onValueChange={() => undefined} />, { wrapper });
    const select = screen.getByRole('combobox', { name: 'ĐVT' });
    await waitFor(async () => expect(await optionLabels(select)).toEqual(['cái', 'thùng']));
    expect(select).toHaveTextContent('thùng');
  });

  it('ĐVT đã ngừng (active=false) server vẫn trả nhưng không có trong ô chọn', async () => {
    const { wrapper } = withServer([unit('cai', 'cái'), unit('thung', 'thùng', { active: false })]);
    render(<UnitSelect aria-label="ĐVT" value="" onValueChange={() => undefined} />, { wrapper });
    const select = screen.getByRole('combobox', { name: 'ĐVT' });
    await waitFor(async () => expect(await optionLabels(select)).toEqual(['cái']));
  });

  it('UI tiếng Anh: nhãn là name_en, thiếu name_en thì dùng tên vi', async () => {
    await act(() => i18n.changeLanguage('en'));
    const { wrapper } = withServer([unit('cai', 'cái', { name_en: 'piece' }), unit('goi', 'gói')]);
    render(<UnitSelect aria-label="Unit" value="" onValueChange={() => undefined} />, { wrapper });
    const select = screen.getByRole('combobox', { name: 'Unit' });
    await waitFor(async () => expect(await optionLabels(select)).toEqual(['piece', 'gói']));
  });
});

describe('useUnitName', () => {
  const units = [unit('cai', 'cái', { name_en: 'piece' }), unit('goi', 'gói')];

  it('member vẫn thấy tên ĐVT đã ngừng; chỉ gọi /api/units một lần, không gọi ?all=1', async () => {
    const { wrapper, fetchMock } = withServer([unit('thung', 'thùng', { active: false })]);
    const { result } = renderHook(() => useUnitName('thung'), { wrapper });
    await waitFor(() => expect(result.current).toBe('thùng'));
    expect(fetchMock.mock.calls.map(([u]) => u)).toEqual(['/api/units']);
  });

  it('vi: tên vi; mã không có trong danh sách → hiện thô mã; null → chuỗi rỗng', async () => {
    const { wrapper } = withServer(units);
    const { result } = renderHook(() => [useUnitName('cai'), useUnitName('kg'), useUnitName(null)], { wrapper });
    await waitFor(() => expect(result.current[0]).toBe('cái'));
    expect(result.current[1]).toBe('kg');
    expect(result.current[2]).toBe('');
  });

  it('en: name_en; thiếu name_en → tên vi', async () => {
    await act(() => i18n.changeLanguage('en'));
    const { wrapper } = withServer(units);
    const { result } = renderHook(() => [useUnitName('cai'), useUnitName('goi')], { wrapper });
    await waitFor(() => expect(result.current[0]).toBe('piece'));
    expect(result.current[1]).toBe('gói');
  });
});
