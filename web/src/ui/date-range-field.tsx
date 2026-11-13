import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { autoUpdate, useFloating } from '@floating-ui/react';
import { isoToDmy } from '@/lib/dmy-date';
import { popoverFit } from './popover-fit';

export interface DayRange {
  from: string;
  to: string;
}

const ZONE = 'Asia/Ho_Chi_Minh';
const DAY_KEY = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: ZONE });
// Khớp DATE_FROM_2000 của api: ngày trước 2000 bị từ chối
const MIN_DAY = '2000-01-01';

const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const keyOf = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return keyOf(d);
};
const addMonths = (iso: string, n: number) => {
  const d = parse(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return keyOf(d);
};
const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;
// Lưới luôn 6 hàng, tuần bắt đầu thứ Hai: đổi tháng không làm lịch nhảy cao thấp
function gridDays(month: string): string[] {
  const first = parse(monthStart(month));
  const lead = (first.getUTCDay() + 6) % 7;
  const start = addDays(keyOf(first), -lead);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000) + 1;
const ordered = (a: string, b: string): DayRange => (a <= b ? { from: a, to: b } : { from: b, to: a });

function useOutside(open: boolean, inside: () => (HTMLElement | null)[], onOutside: () => void) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!inside().some((el) => el?.contains(e.target as Node))) onOutside();
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  });
}

// Một ô khoảng ngày cho thanh lọc: nút cùng dáng ô chọn, bấm ra lịch tháng (chọn ngày đầu rồi ngày cuối).
// Lịch tự dựng thay <input type="date">: ô ngày của trình duyệt hiện theo locale máy (mm/dd ở máy tiếng Anh)
export function DateRangeField({ label, value, error, onChange }: { label: string; value: DayRange; error?: string; onChange: (r: DayRange) => void }) {
  const { t } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const { refs, floatingStyles } = useFloating({
    open,
    strategy: 'fixed',
    placement: 'bottom-start',
    whileElementsMounted: autoUpdate,
    // Lịch cao ~430px: ở 390×800 phía nào của ô cũng thiếu chỗ — popoverFit đẩy vào màn thay vì để mất hàng tháng
    middleware: popoverFit(),
  });
  useOutside(open, () => [refs.floating.current, button.current], () => setOpen(false));

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };
  const shown = value.from && value.to ? `${isoToDmy(value.from)} – ${isoToDmy(value.to)}` : value.from ? t('common.dateRange.since', { d: isoToDmy(value.from) }) : value.to ? t('common.dateRange.until', { d: isoToDmy(value.to) }) : '';
  const noteId = `${id}-note`;

  return (
    <div className={['ff date-range', error ? 'ff--error' : ''].filter(Boolean).join(' ')}>
      <span id={`${id}-label`} className="ff-label">
        {label}
      </span>
      <span className="lb lb--field date-range__box">
        <button
          ref={(el) => {
            button.current = el;
            refs.setReference(el);
          }}
          type="button"
          className="lb-trigger date-range__trigger"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-labelledby={`${id}-label ${id}-value`}
          aria-describedby={error ? noteId : undefined}
          aria-invalid={error ? true : undefined}
          onClick={() => (open ? close(false) : setOpen(true))}
        >
          <span id={`${id}-value`} className="lb-trigger__value" data-placeholder={shown ? undefined : ''}>
            {shown || t('common.dateRange.any')}
          </span>
        </button>
      </span>
      {error && (
        <p id={noteId} className="ff-error">
          {error}
        </p>
      )}
      {open && (
        <div
          ref={refs.setFloating}
          role="dialog"
          aria-label={label}
          className="cal-pop"
          style={floatingStyles}
          data-esc-layer=""
          // Tab ra khỏi lịch (không về nút mở) thì đóng, không để lịch lơ lửng
          onBlur={(e) => {
            const to = e.relatedTarget as Node | null;
            if (to && !e.currentTarget.contains(to) && to !== button.current) setOpen(false);
          }}
        >
          <RangeCalendar
            value={value}
            onPick={(r) => {
              onChange(r);
              close(true);
            }}
            onClear={() => {
              onChange({ from: '', to: '' });
              close(true);
            }}
            onEscape={() => close(true)}
          />
        </div>
      )}
    </div>
  );
}

function RangeCalendar({ value, onPick, onClear, onEscape }: { value: DayRange; onPick: (r: DayRange) => void; onClear: () => void; onEscape: () => void }) {
  const { t, i18n } = useTranslation();
  const today = DAY_KEY.format(new Date());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [focus, setFocus] = useState(value.to || value.from || today);
  const [month, setMonth] = useState(monthStart(focus));
  const grid = useRef<HTMLDivElement>(null);
  const days = gridDays(month);
  const weekdays = t('common.dateRange.weekdays').split(',');
  const monthName = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parse(month));
  const dayName = new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

  // Giữa hai lần bấm: dải chạy theo ngày đang rê/đang đứng, thấy trước khoảng sẽ chọn
  const live = anchor ? ordered(anchor, hover ?? focus) : value.from && value.to ? value : null;

  useLayoutEffect(() => {
    grid.current?.querySelector<HTMLElement>(`[data-day="${focus}"]`)?.focus();
  }, [focus, month]);

  const goto = (day: string) => {
    if (day < MIN_DAY) return;
    setFocus(day);
    if (monthStart(day) !== month) setMonth(monthStart(day));
  };
  const pick = (day: string) => {
    if (day < MIN_DAY) return;
    if (!anchor) {
      setAnchor(day);
      setFocus(day);
      return;
    }
    onPick(ordered(anchor, day));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(focus, -1),
      ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7),
      ArrowDown: () => addDays(focus, 7),
      PageUp: () => addMonths(focus, -1),
      PageDown: () => addMonths(focus, 1),
      Home: () => addDays(focus, -((parse(focus).getUTCDay() + 6) % 7)),
      End: () => addDays(focus, 6 - ((parse(focus).getUTCDay() + 6) % 7)),
    };
    if (e.key in moves) {
      e.preventDefault();
      goto(moves[e.key]());
    }
  };
  const onPopKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    if (anchor) setAnchor(null);
    else onEscape();
  };

  const step = anchor ? t('common.dateRange.pickEnd') : live ? t('common.dateRange.summary', { n: daysBetween(live.from, live.to), from: isoToDmy(live.from), to: isoToDmy(live.to) }) : t('common.dateRange.pickStart');
  const shift = (n: number) => {
    const next = addMonths(month, n);
    setMonth(next);
    setFocus(focus.slice(0, 7) === month.slice(0, 7) ? addMonths(focus, n) : next);
  };

  return (
    <div className="cal" onKeyDown={onPopKey}>
      <div className="cal__head">
        <button type="button" className="cal__nav" aria-label={t('common.dateRange.prev')} disabled={month <= MIN_DAY} onClick={() => shift(-1)}>
          <span className="cal__chev cal__chev--prev" aria-hidden="true" />
        </button>
        <b className="cal__title" aria-live="polite">
          {monthName}
        </b>
        <button type="button" className="cal__nav" aria-label={t('common.dateRange.next')} onClick={() => shift(1)}>
          <span className="cal__chev" aria-hidden="true" />
        </button>
      </div>
      <div ref={grid} role="grid" aria-label={monthName} className="cal__grid" onKeyDown={onKey} onPointerLeave={() => setHover(null)}>
        <div role="row" className="cal__row">
          {weekdays.map((w) => (
            <span key={w} role="columnheader" className="cal__wd">
              {w}
            </span>
          ))}
        </div>
        {[0, 1, 2, 3, 4, 5].map((r) => (
          <div key={r} role="row" className="cal__row">
            {days.slice(r * 7, r * 7 + 7).map((d) => {
              const inRange = live && d >= live.from && d <= live.to;
              const edge = live && (d === live.from || d === live.to);
              const disabled = d < MIN_DAY;
              return (
                <span key={d} role="gridcell" aria-selected={Boolean(inRange)} className="cal__cell" data-in={inRange && !edge ? '' : undefined} data-start={live && d === live.from && live.from !== live.to ? '' : undefined} data-end={live && d === live.to && live.from !== live.to ? '' : undefined}>
                  <button
                    type="button"
                    className="cal__day"
                    data-day={d}
                    data-edge={edge || (anchor === d) ? '' : undefined}
                    data-out={d.slice(0, 7) !== month.slice(0, 7) ? '' : undefined}
                    data-today={d === today ? '' : undefined}
                    tabIndex={d === focus ? 0 : -1}
                    disabled={disabled}
                    aria-label={dayName.format(parse(d))}
                    aria-current={d === today ? 'date' : undefined}
                    onPointerEnter={() => anchor && setHover(d)}
                    onFocus={() => d !== focus && setFocus(d)}
                    onClick={() => pick(d)}
                  >
                    {Number(d.slice(8))}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <div className="cal__foot">
        <span className="cal__step" role="status">
          {step}
        </span>
        {(value.from || value.to) && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClear}>
            {t('common.dateRange.clear')}
          </button>
        )}
      </div>
    </div>
  );
}
