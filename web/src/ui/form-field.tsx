import { useId } from 'react';
import type { ReactNode } from 'react';

export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
}

// Lỗi thay chỗ gợi ý trong mô tả để trình đọc màn hình đọc đúng điều cần sửa
export function FormField({
  label,
  error,
  hint,
  counter,
  className,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  counter?: { value: number; max: number };
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  return (
    <div className={['ff', error ? 'ff--error' : '', className].filter(Boolean).join(' ')}>
      <label className="ff-label" htmlFor={id}>
        {label}
      </label>
      {children({
        id,
        'aria-describedby': note ? noteId : undefined,
        'aria-invalid': error ? true : undefined,
      })}
      {note && (
        <p id={noteId} className={error ? 'ff-error' : 'ff-hint'}>
          {note}
        </p>
      )}
      {counter && (
        <span className="ff-counter num" aria-hidden="true">
          {counter.value}/{counter.max}
        </span>
      )}
    </div>
  );
}
