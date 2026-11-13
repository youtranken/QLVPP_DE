import { useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { shiftYm } from '@/lib/ym';

export type MonthTone = 'locked' | 'open' | 'past';
export interface MonthMark {
  tone: MonthTone;
  label: string;
}

export interface MonthPickerProps {
  value: string;
  // Không có trần/sàn thì vẫn chặn trước 2000 (api từ chối ym trước 2000)
  min?: string;
  max?: string;
  // Tháng nào có dữ liệu thì trả nhãn trạng thái (chấm + chữ nhỏ dưới tên tháng)
  markOf?: (ym: string) => MonthMark | undefined;
  onPick: (ym: string) => void;
  onEscape: () => void;
}

const FLOOR = '2000-01';
const ROWS = [0, 1, 2, 3];
const ymOf = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;
const yearOf = (ym: string) => Number(ym.slice(0, 4));

// Lưới năm-tháng 3×4: nhảy thẳng tới tháng xa (tháng 12 → tháng 1 năm sau) thay vì bấm ‹ › nhiều lần.
// Tháng ngoài [min, max] tắt; phím mũi tên chạy trong khoảng đó, Enter chọn, Esc đóng (nơi gọi trả focus).
export function MonthPicker({ value, min, max, markOf, onPick, onEscape }: MonthPickerProps) {
  const { t } = useTranslation();
  const lo = min && min > FLOOR ? min : FLOOR;
  const clamp = (ym: string) => (ym < lo ? lo : max && ym > max ? max : ym);
  const [focus, setFocus] = useState(() => clamp(value));
  const [year, setYear] = useState(() => yearOf(clamp(value)));
  // Chỉ kéo focus vào ô khi mới mở hoặc đi bằng phím trong lưới; bấm ‹ › năm thì focus ở yên trên nút năm
  const pull = useRef(true);
  const grid = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!pull.current) return;
    pull.current = false;
    grid.current?.querySelector<HTMLElement>(`[data-ym="${focus}"]`)?.focus();
  }, [focus, year]);

  const goto = (ym: string) => {
    const next = clamp(ym);
    pull.current = true;
    setFocus(next);
    setYear(yearOf(next));
  };
  const shiftYear = (n: number) => {
    const next = year + n;
    setYear(next);
    setFocus(clamp(ymOf(next, Number(focus.slice(5)))));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => shiftYm(focus, -1),
      ArrowRight: () => shiftYm(focus, 1),
      ArrowUp: () => shiftYm(focus, -3),
      ArrowDown: () => shiftYm(focus, 3),
      PageUp: () => shiftYm(focus, -12),
      PageDown: () => shiftYm(focus, 12),
      Home: () => ymOf(yearOf(focus), 1),
      End: () => ymOf(yearOf(focus), 12),
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    goto(moves[e.key]());
  };
  const onPanelKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    onEscape();
  };

  return (
    <div className="mp" onKeyDown={onPanelKey}>
      <div className="mp__head">
        <button type="button" className="cal__nav" aria-label={t('common.monthPicker.prevYear')} disabled={year <= yearOf(lo)} onClick={() => shiftYear(-1)}>
          <span className="cal__chev cal__chev--prev" aria-hidden="true" />
        </button>
        <b className="mp__year" aria-live="polite">
          {year}
        </b>
        <button type="button" className="cal__nav" aria-label={t('common.monthPicker.nextYear')} disabled={max !== undefined && year >= yearOf(max)} onClick={() => shiftYear(1)}>
          <span className="cal__chev" aria-hidden="true" />
        </button>
      </div>
      <div ref={grid} role="grid" aria-label={String(year)} className="mp__grid" onKeyDown={onKey}>
        {ROWS.map((r) => (
          <div key={r} role="row" className="mp__row">
            {[1, 2, 3].map((c) => {
              const month = r * 3 + c;
              const ym = ymOf(year, month);
              const off = ym < lo || (max !== undefined && ym > max);
              const mark = off ? undefined : markOf?.(ym);
              const name = t('common.monthPicker.monthYear', { month, year });
              return (
                <span key={ym} role="gridcell" className="mp__cell">
                  <button
                    type="button"
                    className="mp__month"
                    data-ym={ym}
                    tabIndex={ym === focus ? 0 : -1}
                    disabled={off}
                    aria-current={ym === value ? 'true' : undefined}
                    aria-label={mark ? `${name} · ${mark.label}` : name}
                    onFocus={() => ym !== focus && setFocus(ym)}
                    onClick={() => onPick(ym)}
                  >
                    <span className="mp__name">{t('common.monthPicker.month', { month })}</span>
                    {mark && (
                      <span className={`mp__mark mp__mark--${mark.tone}`} aria-hidden="true">
                        {mark.label}
                      </span>
                    )}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
