import { describe, expect, it } from 'vitest';
import { renderWithI18n, screen } from '@/test/test-utils';
import { FormField } from '@/ui/form-field';

const input = (p: object) => <input {...p} />;

describe('FormField counter', () => {
  it('hiện 500/500 tại biên trên', () => {
    renderWithI18n(<FormField label="Lý do" counter={{ value: 500, max: 500 }}>{input}</FormField>);
    expect(screen.getByText('500/500')).toBeInTheDocument();
  });

  it('hiện 0/500 khi trống; không có counter thì không có đếm', () => {
    const { unmount } = renderWithI18n(<FormField label="Lý do" counter={{ value: 0, max: 500 }}>{input}</FormField>);
    expect(screen.getByText('0/500')).toBeInTheDocument();
    unmount();
    renderWithI18n(<FormField label="Lý do">{input}</FormField>);
    expect(screen.queryByText(/\/500/)).not.toBeInTheDocument();
  });

  it('lỗi gắn aria-invalid và aria-describedby vào ô', () => {
    renderWithI18n(<FormField label="Lý do" error="Nhập ít nhất 3 ký tự">{input}</FormField>);
    const field = screen.getByLabelText('Lý do');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById(field.getAttribute('aria-describedby') ?? '')).toHaveTextContent('Nhập ít nhất 3 ký tự');
  });

  it('required: nhãn có "*" và ô mang aria-required; không required thì không có "*"', () => {
    const { unmount } = renderWithI18n(<FormField label="Lý do" required>{input}</FormField>);
    const field = screen.getByLabelText(/^Lý do/);
    expect(field).toHaveAttribute('aria-required', 'true');
    expect(document.querySelector('label')).toHaveTextContent('Lý do *');
    unmount();
    renderWithI18n(<FormField label="Lý do">{input}</FormField>);
    expect(screen.getByLabelText('Lý do')).not.toHaveAttribute('aria-required');
  });
});
