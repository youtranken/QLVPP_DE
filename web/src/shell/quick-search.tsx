import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogTitle } from '@/ui/dialog';
import { Icon } from '@/ui/icon';
import { QUICK_MIN_CHARS, quickSearchIndex } from '@/shell/quick-search-index';
import { useQuickSources } from '@/shell/use-quick-sources';

const KEY_SHORTCUT = 'Control+K';

const isOpenKey = (e: globalThis.KeyboardEvent) => (e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k';

export function QuickSearch({ variant }: { variant: 'field' | 'icon' }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!isOpenKey(e)) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const label = t('nav.quickSearch.label');
  return (
    <>
      {variant === 'field' ? (
        <button type="button" className="qs-trigger" aria-label={label} aria-keyshortcuts={KEY_SHORTCUT} aria-haspopup="dialog" onClick={() => setOpen(true)}>
          <Icon name="search" size={16} />
          <span className="qs-trigger__text" aria-hidden="true">{label}</span>
          <kbd className="qs-trigger__kbd" aria-hidden="true">{t('nav.quickSearch.shortcut')}</kbd>
        </button>
      ) : (
        <button type="button" className="topbar__search" aria-label={label} aria-keyshortcuts={KEY_SHORTCUT} aria-haspopup="dialog" onClick={() => setOpen(true)}>
          <Icon name="search" />
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen} className="qs" viewportClassName="dialog-viewport qs-viewport">
        {open && <QuickSearchPanel onDone={() => setOpen(false)} />}
      </Dialog>
    </>
  );
}

function QuickSearchPanel({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const baseId = useId();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const { sources, loading } = useQuickSources(q);
  const groups = useMemo(() => quickSearchIndex(q, sources), [q, sources]);
  const flat = useMemo(() => groups.flatMap((g) => g.entries), [groups]);
  const current = flat.length ? Math.min(active, flat.length - 1) : -1;
  const optionId = (i: number) => `${baseId}-opt-${i}`;
  const go = (i: number) => {
    const entry = flat[i];
    if (!entry) return;
    onDone();
    navigate(entry.to);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!flat.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((current + step + flat.length) % flat.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(current);
    }
  };
  const short = q.trim().length < QUICK_MIN_CHARS;
  let index = 0;
  return (
    <>
      <DialogTitle className="sr-only">{t('nav.quickSearch.label')}</DialogTitle>
      <div className="qs-input">
        <Icon name="search" size={18} />
        <input
          type="text"
          role="combobox"
          aria-label={t('nav.quickSearch.label')}
          aria-expanded={flat.length > 0}
          aria-controls={`${baseId}-list`}
          aria-autocomplete="list"
          aria-activedescendant={current >= 0 ? optionId(current) : undefined}
          placeholder={t('nav.quickSearch.placeholder')}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        <kbd className="qs-input__kbd" aria-hidden="true">{t('nav.quickSearch.esc')}</kbd>
      </div>
      <div id={`${baseId}-list`} role="listbox" aria-label={t('nav.quickSearch.results')} className="qs-list">
        {groups.map((g) => (
          <div key={g.key} role="group" aria-labelledby={`${baseId}-${g.key}`}>
            <div id={`${baseId}-${g.key}`} className="qs-group" role="presentation">{t(`nav.quickSearch.groups.${g.key}`)}</div>
            {g.entries.map((entry) => {
              const i = index++;
              return (
                <div key={entry.id} id={optionId(i)} role="option" aria-selected={i === current} className="qs-option" onMouseMove={() => setActive(i)} onClick={() => go(i)}>
                  <span className="qs-option__label">{entry.label}</span>
                  {entry.hint && <span className="qs-option__hint">{entry.hint}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="qs-note" role="status">
        {short ? t('nav.quickSearch.tooShort', { n: QUICK_MIN_CHARS }) : flat.length ? '' : loading ? t('nav.quickSearch.loading') : t('nav.quickSearch.empty', { q: q.trim() })}
      </p>
    </>
  );
}
