import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { renderWithI18n } from '@/test/test-utils';
import { ToastProvider } from '@/ui/toast-provider';
import { UnregisteredCard } from './home-cards';

describe('UnregisteredCard — chữ viết tắt trên chip', () => {
  it('"Nguyễn Văn A (demo)" → "NA" (bỏ từ "(demo)"), không phải "A("', () => {
    const { container } = renderWithI18n(
      <MemoryRouter>
        <ToastProvider>
        <UnregisteredCard ym="2026-10" deadline="2026-10-10T17:00:00.000Z" count={1} registered={4} headcount={5} people={[{ sub: 'u1', full_name: 'Nguyễn Văn A (demo)', email: null, department: null }]} />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(container.querySelector('.hm-chip__av')?.textContent).toBe('NA');
  });
});
