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

// Test bấm <a href>/gán location thật: jsdom chỉ in "Not implemented: navigation to another Document" ra stderr
// mà test vẫn xanh, che mất lời gọi điều hướng thật. Bắt lỗi đó và đánh rơi test — mock @/lib/navigate hoặc
// captureDownloads() (tải tệp) thay vì bấm thật.
const navigations: string[] = [];
(globalThis as { jsdom?: { virtualConsole: { on: (e: 'jsdomError', f: (err: Error) => void) => void } } }).jsdom?.virtualConsole.on(
  'jsdomError',
  (err) => {
    if (/Not implemented: navigation/.test(err.message)) navigations.push(err.message);
  },
);

afterEach(() => {
  cleanup();
  if (navigations.length) {
    const n = navigations.splice(0).length;
    throw new Error(`Test điều hướng tài liệu thật ${n} lần (jsdom không làm được): mock @/lib/navigate hoặc dùng captureDownloads()`);
  }
});
