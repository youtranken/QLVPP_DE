import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
// i18n toàn cục (vi mặc định) để useTranslation trả chuỗi thật trong test
import '@/lib/i18n';

// jsdom không có hộp in: giả như Chrome — beforeprint/afterprint bắn đồng bộ trong window.print()
window.print = () => {
  window.dispatchEvent(new Event('beforeprint'));
  window.dispatchEvent(new Event('afterprint'));
};

afterEach(() => {
  cleanup();
});
