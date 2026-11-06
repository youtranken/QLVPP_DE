import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderWithI18n } from '@/test/test-utils';
import { snapshotDataFixture } from './reports-fixtures';
import { PrintPortal } from './print-portal';

const CSS = readFileSync(resolve(__dirname, 'print.m1.css'), 'utf8');

describe('PrintPortal: vùng in ngoài cây shell', () => {
  it('portal ra document.body, ngoài khung render; chỉ tờ trình ký, không phụ lục', () => {
    const { container } = renderWithI18n(<PrintPortal snap={snapshotDataFixture()} />);
    const region = document.querySelector('[data-print-portal]');
    expect(region?.parentElement).toBe(document.body);
    expect(container.contains(region)).toBe(false);
    expect(region?.querySelector('h1')).toHaveTextContent('Phiếu đề xuất văn phòng phẩm');
    expect(region?.textContent).not.toMatch(/Phụ lục/);
  });

  it('chưa có bản → không có vùng in', () => {
    renderWithI18n(<PrintPortal snap={null} />);
    expect(document.querySelector('[data-print-portal]')).toBeNull();
  });
});

describe('print.m1.css: chỉ vùng in ra giấy, không @page toàn cục', () => {
  const printBlock = CSS.slice(CSS.indexOf('@media print'));

  it('không còn @page toàn cục (chèn lúc in, gỡ sau)', () => {
    expect(CSS).not.toMatch(/@page/);
  });

  it('màn hình: vùng in ẩn; lúc in: ẩn mọi con của body trừ vùng in (shell #root, hộp thoại, toast)', () => {
    expect(CSS).toMatch(/\[data-shell='admin'\] \.pp-portal \{ display: none; \}/);
    expect(printBlock).toMatch(/\[data-shell='admin'\]:has\(> \.pp-portal\) > :not\(\.pp-portal\) \{ display: none !important; \}/);
    expect(printBlock).toMatch(/\[data-shell='admin'\] \.pp-portal \{ display: block; \}/);
  });

  it('lúc in: thead lặp mỗi trang, hàng và khối ký không bị cắt, giữ màu', () => {
    expect(printBlock).toMatch(/thead \{ display: table-header-group; \}/);
    expect(printBlock).toMatch(/tr \{ break-inside: avoid; \}/);
    expect(printBlock).toMatch(/\.pp-signs \{ break-inside: avoid; \}/);
    expect(printBlock).toMatch(/print-color-adjust: exact/);
  });
});
