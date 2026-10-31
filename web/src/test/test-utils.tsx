import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
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
