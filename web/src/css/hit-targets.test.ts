import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// vitest chạy với cwd = web/ (css?raw trả rỗng trong môi trường này) → đọc thẳng file
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

describe('vùng bấm', () => {
  it.each([
    ['features/stock/stock.m1.css', 'sk-item', 'sk-item__name'],
    ['features/directory/directory.m1.css', 'dr-person', 'dr-person__name'],
  ])('%s: nút tên phủ cả ô (ô làm mốc, ::after inset 0), không chỉ cao một dòng chữ', (file, cell, name) => {
    const css = read(file);
    expect(css).toMatch(new RegExp(`\\.table td:has\\(> \\.${cell}\\)\\s*\\{\\s*position:\\s*relative`));
    expect(css).toMatch(new RegExp(`\\.${name}::after\\s*\\{[^}]*position:\\s*absolute;[^}]*inset:\\s*0`));
    // Nút không tự làm mốc, không thì lớp phủ co về đúng dòng chữ
    expect(css).not.toMatch(new RegExp(`\\.${name}\\s*\\{[^}]*position:\\s*relative`));
  });

  it('Danh bạ: email đứng trên lớp phủ của nút tên (L3 vòng 8) — không thì title và bôi đen email không tới được', () => {
    expect(read('features/directory/directory.m1.css')).toMatch(/\.dr-person__email\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*1/);
  });

  it('Stepper chung: ô số giữa cao bằng hàng (sm 32 / md 44, điện thoại 44); không còn mũi tên ▲▼ 24×16 hay dáng riêng của Cấu hình', () => {
    expect(read('css/fields.css')).toMatch(/\[data-shell\] \.stepper > input\s*\{\s*align-self:\s*stretch/);
    const states = read('css/m1/states.css');
    expect(states).toMatch(/\.stepper\[data-size='sm'\]\s*\{\s*--stp-h:\s*32px/);
    expect(states).toMatch(/\.stepper input,[^{]*\{[^}]*height:\s*var\(--stp-h\)/);
    expect(states).toMatch(/@media \(max-width: 767px\)[\s\S]*\.stepper\[data-size='sm'\]\s*\{\s*--stp-h:\s*var\(--hit\)/);
    for (const f of ['css/fields.css', 'features/admin/config.m1.css', 'features/summary/summary.m1.css', 'features/reports/reports.m1.css']) {
      const css = read(f);
      expect(css).not.toMatch(/qty-input__spin|\.cf-adjust button|\.aj-line \.stepper/);
    }
  });

  // Rà soát 13/11 #9: hộp Xuất lẻ — ô Người nhận 36px giữa các ô 44px, nhãn "Dùng chung" chỉ cao 21px
  it('Ô tìm người (UserPicker) cao bằng ô form chung (min-height var(--hit)), thắng .a-input 36px của shell', () => {
    expect(read('features/directory/user-picker.css')).toMatch(/\[data-shell='admin'\] \.user-picker \.a-input\s*\{[^}]*min-height:\s*var\(--hit\)/);
  });

  it('Nhãn checkbox .a-check (Dùng chung, Thêm vào danh mục) cao tối thiểu var(--hit)', () => {
    expect(read('css/admin.css')).toMatch(/\.a-check label\s*\{[^}]*min-height:\s*var\(--hit\)/);
  });

  // Rà soát 13/11 Gu #10: lớp nổi ở 390 — VI/EN trong menu quản lý, ‹ › năm (chọn năm-tháng), ‹ › người (Xem phiếu) chỉ 36px.
  it('lớp nổi ở điện thoại: nút 36px nới vùng chạm đủ 44px bằng ::after, cỡ nhìn giữ nguyên', () => {
    const css = read('css/m1/overlay.css');
    const phone = css.slice(css.lastIndexOf('@media (max-width: 767px)'));
    for (const el of ['.cal__nav', '.side-sheet .seg button']) {
      const e = el.replace(/\./g, '\\.');
      expect(phone).toMatch(new RegExp(`\\[data-shell='admin'\\] ${e}[,\\s][^{]*\\{\\s*position:\\s*relative`));
      expect(phone).toMatch(new RegExp(`\\[data-shell='admin'\\] ${e}::after[^{]*\\{[^}]*position:\\s*absolute;[^}]*inset:\\s*min\\(0px, calc\\(50% - var\\(--hit\\) / 2\\)\\)`));
    }
  });
});
