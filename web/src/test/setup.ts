import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
// i18n toàn cục (vi mặc định) để useTranslation trả chuỗi thật trong test
import '@/lib/i18n';

afterEach(() => {
  cleanup();
});
