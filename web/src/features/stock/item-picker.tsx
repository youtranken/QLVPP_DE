import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { matchesSearch } from '@/lib/search';
import { SearchClear } from '@/ui/search-clear';
import '@/features/directory/user-picker.css';
import type { StockRow } from './stock-rows';

// Cùng dáng ô chọn người nhận ngay dưới: gõ tên để lọc, mỗi món ghi số trong tủ
export function ItemPicker({ choices, value, onChange }: { choices: StockRow[]; value: string; onChange: (id: string) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const chosen = choices.find((r) => r.id === value);
  const shown = choices.filter((r) => matchesSearch(r.name, text));
  return (
    <fieldset className="user-picker">
      <legend className="ff-label">
        {t('stock.dialog.pickItem')}
        <span className="ff-req" aria-hidden="true"> *</span>
      </legend>
      {chosen ? (
        <div className="user-picker-chosen">
          <span>{chosen.name}</span>
          <button type="button" className="btn btn--sm" onClick={() => onChange('')}>
            {t('stock.dialog.pickChange')}
          </button>
        </div>
      ) : (
        <div className="user-picker-field">
          <span className="search-wrap">
            <input
              ref={inputRef}
              autoFocus
              className="a-input"
              type="search"
              aria-label={t('stock.dialog.pickSearch')}
              aria-required
              placeholder={t('stock.dialog.pickPlaceholder')}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
            />
            <SearchClear className="search-box-x" value={text} onClear={() => setText('')} inputRef={inputRef} />
          </span>
          <ul className="user-picker-list" aria-label={t('stock.dialog.pickList')}>
            {shown.length === 0 && <li className="user-picker-empty">{t('stock.dialog.pickEmpty')}</li>}
            {shown.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => onChange(r.id)}>
                  <b>{r.name}</b>
                  <small>{t('stock.dialog.pickStock', { n: r.stock_qty })}</small>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </fieldset>
  );
}
