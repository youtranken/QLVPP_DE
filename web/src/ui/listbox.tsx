import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { autoUpdate, useFloating } from '@floating-ui/react';
import { foldVi } from '@/lib/search';
import { popoverFit } from './popover-fit';

export interface ListboxOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface ListboxProps<T extends string> {
  value: T;
  options: ListboxOption<T>[];
  onChange: (value: T) => void;
  id?: string;
  // Chữ hiện khi giá trị chưa khớp lựa chọn nào (vd "Chọn món")
  placeholder?: string;
  disabled?: boolean;
  title?: string;
  className?: string;
  // pill: nút lọc trên thanh công cụ; field: ô trong form, cùng dáng ô nhập
  variant?: 'field' | 'pill';
  autoFocus?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  'aria-required'?: true;
  children?: ReactNode;
}

const TYPEAHEAD_MS = 600;
const PAGE = 8;
const GAP = 6;
const EDGE = 8;
// Lộ 7 mục rưỡi: mục cuối bị cắt ngang báo còn nữa
const MAX_LIST_H = 332;

const optionId = (id: string, i: number) => `${id}-opt-${i}`;

// Nhãn của FormField có id này: combobox không lấy tên từ chữ bên trong nên phải trỏ aria-labelledby tới nhãn
const fieldLabelId = (controlId: string) => `${controlId}-label`;

function nextEnabled<T extends string>(options: ListboxOption<T>[], from: number, step: 1 | -1): number {
  for (let i = from; i >= 0 && i < options.length; i += step) if (!options[i].disabled) return i;
  return -1;
}

function useTypeahead<T extends string>(options: ListboxOption<T>[]) {
  const buffer = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  // Gõ lặp một chữ thì xoay vòng các mục cùng chữ đầu; gõ liền nhiều chữ thì tìm mục bắt đầu bằng cả cụm (bỏ dấu)
  const find = (key: string, current: number): number => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => (buffer.current = ''), TYPEAHEAD_MS);
    buffer.current += foldVi(key);
    const q = buffer.current;
    const same = q.split('').every((c) => c === q[0]);
    const needle = same ? q[0] : q;
    const start = same ? current + 1 : Math.max(current, 0);
    const n = options.length;
    for (let k = 0; k < n; k++) {
      const i = (start + k) % n;
      if (!options[i].disabled && foldVi(options[i].label).startsWith(needle)) return i;
    }
    return -1;
  };
  // Phím cách đang nằm giữa một cụm gõ tìm ("bút bi") là chữ, không phải lệnh chọn
  return { find, typing: () => buffer.current !== '' };
}

// Ô chọn tự dựng thay <select>: danh sách xổ ra cùng kiểu với app (menu xám của hệ điều hành lạc giữa app).
// Mẫu combobox chỉ-chọn của WAI-ARIA: focus ở lại nút, mục đang sáng báo qua aria-activedescendant.
export function Listbox<T extends string>({
  value,
  options,
  onChange,
  id: idProp,
  placeholder,
  disabled,
  title,
  className,
  variant = 'field',
  autoFocus,
  children,
  ...aria
}: ListboxProps<T>) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const button = useRef<HTMLButtonElement>(null);
  const typeahead = useTypeahead(options);
  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;
  // Giá trị lạ (không khớp lựa chọn nào) mà không có placeholder: hiện lựa chọn đầu như <select> cũ, không để nút trống trơn.
  // Nơi nào giá trị lạ có nghĩa (lọc theo URL) thì tự thêm lựa chọn cho nó, như Danh bạ với ?dept=
  const shownLabel = selected?.label ?? placeholder ?? options[0]?.label ?? '';
  const labelledBy = aria['aria-label'] ? undefined : (aria['aria-labelledby'] ?? (idProp ? fieldLabelId(idProp) : undefined));

  const { refs, floatingStyles } = useFloating({
    open,
    strategy: 'fixed',
    placement: 'bottom-start',
    whileElementsMounted: autoUpdate,
    middleware: popoverFit({
      gap: GAP,
      edge: EDGE,
      apply({ rects, availableHeight, elements }) {
        elements.floating.style.minWidth = `${rects.reference.width}px`;
        elements.floating.style.maxHeight = `${Math.max(120, Math.min(MAX_LIST_H, availableHeight))}px`;
      },
    }),
  });

  useEffect(() => {
    if (autoFocus) button.current?.focus();
  }, [autoFocus]);

  // Mở ra thì cuộn tới mục đang sáng (mặc định là mục đang chọn)
  useLayoutEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(optionId(id, active))?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active, id]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!refs.floating.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open, refs.floating]);

  const show = (at: number) => {
    setActive(at >= 0 ? at : nextEnabled(options, 0, 1));
    setOpen(true);
  };
  const pick = (i: number) => {
    const o = options[i];
    if (!o || o.disabled) return;
    setOpen(false);
    button.current?.focus();
    if (o.value !== value) onChange(o.value);
  };
  const move = (to: number, step: 1 | -1) => {
    const i = nextEnabled(options, Math.min(Math.max(to, 0), options.length - 1), step);
    if (i >= 0) setActive(i);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const printable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (!open) {
      if (e.key === ' ' && typeahead.typing()) {
        e.preventDefault();
        const i = typeahead.find(e.key, selectedIndex);
        if (i >= 0) show(i);
        return;
      }
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        show(selectedIndex);
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        show(e.key === 'Home' ? nextEnabled(options, 0, 1) : nextEnabled(options, options.length - 1, -1));
      } else if (printable) {
        const i = typeahead.find(e.key, selectedIndex);
        if (i >= 0) show(i);
      }
      return;
    }
    const steps: Record<string, [number, 1 | -1]> = {
      ArrowDown: [active + 1, 1],
      ArrowUp: [active - 1, -1],
      Home: [0, 1],
      End: [options.length - 1, -1],
      PageDown: [active + PAGE, 1],
      PageUp: [active - PAGE, -1],
    };
    if (e.key in steps) {
      e.preventDefault();
      move(...steps[e.key]);
    } else if (e.key === 'Enter' || (e.key === ' ' && !typeahead.typing())) {
      e.preventDefault();
      pick(active);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'Tab') {
      setOpen(false);
    } else if (printable) {
      e.preventDefault();
      const i = typeahead.find(e.key, active);
      if (i >= 0) setActive(i);
    }
  };

  return (
    <span className={['lb', `lb--${variant}`, className].filter(Boolean).join(' ')}>
      <button
        ref={(el) => {
          button.current = el;
          refs.setReference(el);
        }}
        id={id}
        type="button"
        role="combobox"
        className="lb-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? optionId(id, active) : undefined}
        aria-label={aria['aria-label']}
        aria-labelledby={labelledBy}
        aria-describedby={aria['aria-describedby']}
        aria-invalid={aria['aria-invalid']}
        aria-required={aria['aria-required']}
        disabled={disabled}
        title={title}
        onClick={() => (open ? setOpen(false) : show(selectedIndex))}
        onKeyDown={onKeyDown}
      >
        <span className="lb-trigger__value" data-placeholder={!selected && placeholder !== undefined ? '' : undefined}>
          {shownLabel}
        </span>
      </button>
      {children}
      {open && (
        <ul ref={refs.setFloating} id={listId} role="listbox" className="lb-list" style={floatingStyles} aria-labelledby={labelledBy} aria-label={aria['aria-label']} tabIndex={-1}>
          {options.map((o, i) => (
            <li
              key={o.value}
              id={optionId(id, i)}
              role="option"
              className="lb-option"
              aria-selected={o.value === value}
              aria-disabled={o.disabled || undefined}
              data-active={i === active ? '' : undefined}
              onPointerMove={() => !o.disabled && i !== active && setActive(i)}
              // Giữ focus ở nút: bấm chuột vào mục không kéo focus đi
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(i)}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}

