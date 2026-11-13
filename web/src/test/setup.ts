import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
// i18n toàn cục (vi mặc định) để useTranslation trả chuỗi thật trong test
import '@/lib/i18n';

// jsdom không có hộp in: giả như Chrome — beforeprint/afterprint bắn đồng bộ trong window.print()
window.print = () => {
  window.dispatchEvent(new Event('beforeprint'));
  window.dispatchEvent(new Event('afterprint'));
};

// findBy/waitFor mặc định 1 s: chạy cả bộ --maxWorkers=6 lúc máy tải nặng thì màn nặng (RequestPage,
// ReportSend, Users 2001 người) rơi ngẫu nhiên — 3 s đủ chỗ, test hỏng thật vẫn rơi
configure({ asyncUtilTimeout: 3000 });

afterEach(() => {
  cleanup();
});
