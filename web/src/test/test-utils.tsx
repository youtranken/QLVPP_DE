import type { ReactElement } from 'react';
import { render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';
import { unitsQuery } from '@/features/units/units.api';
import { SEED_UNITS } from '@/test/fixtures-units';

// QueryClient mới mỗi test, tắt retry để lỗi hiện ngay; ĐVT seed sẵn như 0111 để stub fetch của từng test không phải trả /api/units
export function renderWithI18n(ui: ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  qc.setQueryData(unitsQuery.queryKey, SEED_UNITS);
  return render(
    <QueryClientProvider client={qc}>
      <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
    </QueryClientProvider>,
  );
}

export function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

export * from '@testing-library/react';
export { userEvent };

// Ô chọn tự dựng (ui/listbox): mở danh sách rồi bấm mục theo tên — thay userEvent.selectOptions của <select> gốc
export async function pickOption(box: HTMLElement, name: string | RegExp) {
  if (box.getAttribute('aria-expanded') !== 'true') await userEvent.click(box);
  const list = document.getElementById(box.getAttribute('aria-controls') ?? '');
  if (!list) throw new Error('listbox not open');
  await userEvent.click(within(list).getByRole('option', { name }));
}

// Mở ô chọn tự dựng, đọc nhãn các mục rồi đóng lại (Esc)
export async function optionLabels(box: HTMLElement): Promise<string[]> {
  if (box.getAttribute('aria-expanded') !== 'true') await userEvent.click(box);
  const list = document.getElementById(box.getAttribute('aria-controls') ?? '');
  const labels = list ? within(list).queryAllByRole('option').map((o) => o.textContent ?? '') : [];
  box.focus();
  await userEvent.keyboard('{Escape}');
  return labels;
}
