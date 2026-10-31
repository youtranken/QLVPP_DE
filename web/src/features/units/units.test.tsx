import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, jsonResponse, renderHook, screen, waitFor, within } from '@/test/test-utils';
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
  it('chỉ hiện ĐVT server trả (đang dùng) theo đúng thứ tự API, sau ô "Chọn"', async () => {
    const { wrapper } = withServer([unit('thung', 'thùng'), unit('cai', 'cái'), unit('goi', 'gói')]);
    render(<UnitSelect aria-label="ĐVT" value="" onValueChange={() => undefined} />, { wrapper });
    const select = screen.getByRole('combobox', { name: 'ĐVT' });
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(4));
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      i18n.t('catalog.form.unitPlaceholder'),
      'thùng',
      'cái',
      'gói',
    ]);
  });

  it('dòng/món cũ đang giữ ĐVT đã ngừng: ô chọn vẫn giữ lựa chọn đó ở cuối, không chọn thêm được ĐVT ngừng khác', async () => {
    const { wrapper } = withServer([unit('cai', 'cái')]);
    render(<UnitSelect aria-label="ĐVT" value="thung" onValueChange={() => undefined} />, { wrapper });
    const select = screen.getByRole('combobox', { name: 'ĐVT' });
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(3));
    expect(within(select).getAllByRole('option').map((o) => o.getAttribute('value'))).toEqual(['', 'cai', 'thung']);
    expect(select).toHaveValue('thung');
  });

  it('UI tiếng Anh: nhãn là name_en, thiếu name_en thì dùng tên vi', async () => {
    await act(() => i18n.changeLanguage('en'));
    const { wrapper } = withServer([unit('cai', 'cái', { name_en: 'piece' }), unit('goi', 'gói')]);
    render(<UnitSelect aria-label="Unit" value="" onValueChange={() => undefined} />, { wrapper });
    const select = screen.getByRole('combobox', { name: 'Unit' });
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(3));
    expect(within(select).getAllByRole('option').slice(1).map((o) => o.textContent)).toEqual(['piece', 'gói']);
  });
});

describe('useUnitName', () => {
  const units = [unit('cai', 'cái', { name_en: 'piece' }), unit('goi', 'gói')];

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
