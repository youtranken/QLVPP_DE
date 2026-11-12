import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderWithI18n, screen } from '@/test/test-utils';
import { DayInput } from './day-input';

const props = { label: 'Hạn đăng ký', hint: 'h', unit: 'ngày', value: '40', min: 3, max: 28, downLabel: 'Giảm', upLabel: 'Tăng', onChange: () => {} };

describe('DayInput · viền lỗi (L1 vòng 8)', () => {
  it('có lỗi → viên Stepper bật is-invalid (ô số trong khung có border:0 nên viền đỏ phải nằm ở khung); hết lỗi → tắt', () => {
    const { rerender } = renderWithI18n(<DayInput {...props} error="Ngoài 3–28" />);
    const frame = screen.getByLabelText('Hạn đăng ký').closest('.stepper');
    expect(frame).toHaveClass('is-invalid');
    rerender(<DayInput {...props} value="8" />);
    expect(screen.getByLabelText('Hạn đăng ký').closest('.stepper')).not.toHaveClass('is-invalid');
  });

  it('CSS: viền đỏ là box-shadow của khung .stepper.is-invalid, không phải border ô số (bị .ff .stepper input{border:0} đè)', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/css/m1/states.css'), 'utf8');
    expect(css).toMatch(/\.stepper\.is-invalid\s*\{\s*box-shadow:\s*inset 0 0 0 2px var\(--c-danger\)/);
    expect(css).toMatch(/\.ff \.stepper input\s*\{[^}]*border:\s*0/);
  });
});
