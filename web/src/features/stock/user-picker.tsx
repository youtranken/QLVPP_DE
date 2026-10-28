import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { userLabel, useUserSearch, type DirectoryUser } from '@/features/stock/stock.api';

const SEARCH_DEBOUNCE_MS = 250;

const describe = (u: DirectoryUser) => [userLabel(u), u.department ?? u.email].filter(Boolean).join(' · ');

// Chỉ người đang hoạt động mới chọn được; server vẫn kiểm lại (USER_INACTIVE)
export function UserPicker({
  value,
  error,
  hint,
  onChange,
}: {
  value: DirectoryUser | null;
  error?: string;
  hint?: string;
  onChange: (u: DirectoryUser | null) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const users = useUserSearch(search.trim());

  useEffect(() => {
    const timer = setTimeout(() => setSearch(text), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  return (
    <fieldset className={['user-picker', error ? 'ff--error' : ''].filter(Boolean).join(' ')}>
      <legend className="ff-label">{t('stock.picker.label')}</legend>
      {value ? (
        <div className="user-picker-chosen">
          <span>{describe(value)}</span>
          <button type="button" className="btn btn--sm" onClick={() => onChange(null)}>
            {t('stock.picker.change')}
          </button>
        </div>
      ) : (
        <>
          <input
            className="a-input"
            type="search"
            aria-label={t('stock.picker.search')}
            placeholder={t('stock.picker.searchHint')}
            aria-describedby={note ? noteId : undefined}
            aria-invalid={error ? true : undefined}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <ul className="user-picker-list" aria-label={t('stock.picker.results')} aria-busy={users.isFetching}>
            {users.data?.items.length === 0 && <li className="user-picker-empty">{t('stock.picker.empty')}</li>}
            {users.data?.items.map((u) => (
              <li key={u.sub}>
                <button type="button" disabled={u.status !== 'active'} onClick={() => onChange(u)}>
                  <b>{userLabel(u)}</b>
                  <small>
                    {u.status === 'active' ? (u.department ?? u.email ?? '') : t('stock.picker.locked')}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {note && (
        <p id={noteId} className={error ? 'ff-error' : 'ff-hint'}>
          {note}
        </p>
      )}
    </fieldset>
  );
}
