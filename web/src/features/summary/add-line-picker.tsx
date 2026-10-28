import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdminItem } from '@/features/catalog/catalog.api';
import { matchesSearch, useRequestFormat } from '@/features/request/request-format';

const LIMIT = 8;

// Tìm ngay trong ngăn/hộp (không popover) để khỏi vướng bẫy focus của dialog
export function AddLinePicker({ items, onPick }: { items: AdminItem[]; onPick: (item: AdminItem) => void }) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  if (!open) {
    return (
      <button type="button" className="btn btn--sm aj-add" onClick={() => setOpen(true)}>
        {t('summary.picker.add')}
      </button>
    );
  }

  const pick = (i: AdminItem) => {
    onPick(i);
    setQ('');
  };
  const found = items.filter((i) => !q.trim() || matchesSearch(`${i.name} ${i.name_en ?? ''}`, q)).slice(0, LIMIT);
  return (
    <div className="aj-picker">
      <div className="aj-picker-bar">
        <input
          className="a-input"
          type="search"
          autoFocus
          aria-label={t('summary.picker.search')}
          aria-controls={`${id}-list`}
          placeholder={t('summary.picker.search')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          // Nằm trong form của ngăn/hộp: Enter chọn món đầu thay vì lưu sớm
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (q.trim() && found[0]) pick(found[0]);
          }}
        />
        <button type="button" className="btn btn--sm" onClick={() => setOpen(false)}>
          {t('summary.picker.done')}
        </button>
      </div>
      <ul id={`${id}-list`} className="aj-picker-list" aria-label={t('summary.picker.results')}>
        {found.length === 0 && <li className="aj-picker-empty">{t('summary.picker.empty')}</li>}
        {found.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              onClick={() => pick(i)}
            >
              <span>{t('summary.picker.option', { name: fmt.name(i), unit: fmt.unit(i.unit) })}</span>
              {i.admin_only && <span className="tag">{t('summary.adjust.adminOnly')}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
