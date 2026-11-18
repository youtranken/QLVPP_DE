import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { autoUpdate, useFloating } from '@floating-ui/react';
import { shiftYm } from '@/lib/ym';
import { Icon } from '@/ui/icon';
import { MonthPicker, type MonthMark } from './month-picker';
import { popoverFit } from './popover-fit';

interface MonthSwitcherProps {
  value: string;
  onChange: (ym: string) => void;
  formatLabel: (ym: string) => string;
  labels: { group: string; prev: string; next: string };
  min?: string;
  max?: string;
  status?: { tone: 'ok' | 'dark'; label: string };
  // Kỳ sau trần (kỳ đang mở) hiện vô hiệu kèm nhãn, để người xem biết vì sao không đi tiếp được
  beyond?: { ym: string; label: string };
  // Có thì nút kỳ sau trần bấm được (kỳ đang mở xem được), aria-pressed khi đang xem đúng kỳ đó
  onBeyond?: () => void;
  // Nhãn trạng thái từng tháng trong bảng năm-tháng (trang nào biết tháng nào có dữ liệu thì truyền)
  markOf?: (ym: string) => MonthMark | undefined;
  // Lý do nút › tắt ở trần, đọc qua chú thích của chính nút (không thêm nút chữ dài cạnh viên)
  nextReason?: string;
}

// ym dạng 'YYYY-MM' so sánh chuỗi được trực tiếp
export function MonthSwitcher({ value, onChange, formatLabel, labels, min, max, status, beyond, onBeyond, markOf, nextReason }: MonthSwitcherProps) {
  const { t } = useTranslation();
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const { refs, floatingStyles } = useFloating({
    open,
    strategy: 'fixed',
    placement: 'bottom',
    whileElementsMounted: autoUpdate,
    middleware: popoverFit(),
  });
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!refs.floating.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open, refs.floating]);
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const label = formatLabel(value);
  const atMax = max !== undefined && value >= max;
  const nextWhy = atMax ? nextReason : undefined;
  return (
    <>
      <div className="month-switch" role="group" aria-label={labels.group}>
        {/* Khung viên ‹ tháng ›: máy tính "display: contents" (cả cụm một viên); điện thoại là viên riêng để nhãn kỳ mở dài nằm ngoài, viên không gãy dòng */}
        <div className="month-switch__pill">
          <button
            type="button"
            aria-label={labels.prev}
            disabled={min !== undefined && value <= min}
            onClick={() => onChange(shiftYm(value, -1))}
          >
            <Icon name="chevl" size={18} />
          </button>
          {/* Bấm nhãn tháng mở bảng năm-tháng: đi xa (tháng 12 → tháng 1) không phải bấm ‹ › nhiều lần */}
          <button
            ref={(el) => {
              trigger.current = el;
              refs.setReference(el);
            }}
            type="button"
            className="month-switch__label"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={`${label}, ${t('common.monthPicker.open')}`}
            onClick={() => setOpen((v) => !v)}
          >
            <span aria-live="polite">{label}</span>
            <Icon name="chev" size={14} />
          </button>
          <button
            type="button"
            aria-label={labels.next}
            disabled={atMax}
            aria-describedby={nextWhy ? reasonId : undefined}
            title={nextWhy}
            onClick={() => onChange(shiftYm(value, 1))}
          >
            <Icon name="chevr" size={18} />
          </button>
          {nextWhy && (
            <span id={reasonId} hidden>
              {nextWhy}
            </span>
          )}
        </div>
        {beyond && (
          <button
            type="button"
            className="month-switch__beyond"
            disabled={!onBeyond}
            aria-pressed={onBeyond ? value === beyond.ym : undefined}
            onClick={onBeyond}
            aria-label={`${formatLabel(beyond.ym)} · ${beyond.label}`}>
            {beyond.label}
          </button>
        )}
        {status && <span className={`month-switch__status month-switch__status--${status.tone}`}>{status.label}</span>}
      </div>
      {/* Bảng nằm ngoài .month-switch: luật nút tròn 32px của viên không áp vào ô tháng */}
      {open && (
        <div
          ref={refs.setFloating}
          role="dialog"
          aria-label={t('common.monthPicker.dialog')}
          className="cal-pop"
          style={floatingStyles}
          data-esc-layer=""
          // Tab ra khỏi bảng (không về nhãn tháng) thì đóng, không để bảng lơ lửng
          onBlur={(e) => {
            const to = e.relatedTarget as Node | null;
            if (to && !e.currentTarget.contains(to) && to !== trigger.current) setOpen(false);
          }}
        >
          <MonthPicker
            value={value}
            min={min}
            max={max}
            markOf={markOf}
            onPick={(ym) => {
              close();
              if (ym !== value) onChange(ym);
            }}
            onEscape={close}
          />
        </div>
      )}
    </>
  );
}
