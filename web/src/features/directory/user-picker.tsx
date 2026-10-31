import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { userLabel, useUserSearch, type DirectoryUser } from '@/features/directory/directory.api';
import '@/features/directory/user-picker.css';

const SEARCH_DEBOUNCE_MS = 250;

const describe = (u: DirectoryUser) => [userLabel(u), u.department ?? u.email].filter(Boolean).join(' · ');

// Mặc định chỉ người đang hoạt động mới chọn được (server vẫn kiểm USER_INACTIVE); lọc nhật ký thì cho chọn cả người đã khóa
export function UserPicker({
  label,
  searchLabel,
  value,
  error,
  hint,
  allowLocked = false,
  resultsWhenEmpty = true,
  excludeAdmin = false,
  required = false,
  badge,
  onChange,
  onEnter,
}: {
  label: string;
  searchLabel: string;
  value: DirectoryUser | null;
  error?: string;
  hint?: string;
  allowLocked?: boolean;
  resultsWhenEmpty?: boolean;
  excludeAdmin?: boolean;
  required?: boolean;
  badge?: (u: DirectoryUser) => ReactNode;
  onChange: (u: DirectoryUser | null) => void;
  onEnter?: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const users = useUserSearch(search.trim(), { excludeAdmin });

  useEffect(() => {
    const timer = setTimeout(() => setSearch(text), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  return (
    <fieldset className={['user-picker', error ? 'ff--error' : ''].filter(Boolean).join(' ')}>
      <legend className="ff-label">
        {label}
        {required && <span className="ff-req" aria-hidden="true"> *</span>}
      </legend>
      {value ? (
        <div className="user-picker-chosen">
          <span>{describe(value)}</span>
          <button type="button" className="btn btn--sm" onClick={() => onChange(null)}>
            {t('directory.picker.change')}
          </button>
        </div>
      ) : (
        <>
          <input
            className="a-input"
            type="search"
            aria-label={searchLabel}
            placeholder={t('directory.picker.searchHint')}
            aria-describedby={note ? noteId : undefined}
            aria-invalid={error ? true : undefined}
            aria-required={required || undefined}
            value={text}
            onChange={(e) => setText(e.target.value)}
            // Ô tìm hay nằm trong form khác (tạo hộ, xuất lẻ): Enter không tự gửi form, chỉ form nào muốn mới nhận qua onEnter
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              onEnter?.();
            }}
          />
          {(resultsWhenEmpty || search.trim() !== '') && (
            <ul className="user-picker-list" aria-label={t('directory.picker.results')} aria-busy={users.isFetching}>
              {users.data?.items.length === 0 && <li className="user-picker-empty">{t('directory.picker.empty')}</li>}
              {users.data?.items.map((u) => (
                <li key={u.sub}>
                  <button type="button" disabled={!allowLocked && u.status !== 'active'} onClick={() => onChange(u)}>
                    <b>{userLabel(u)}</b>
                    {u.status === 'active' && badge?.(u)}
                    <small>
                      {u.status === 'active' ? (u.department ?? u.email ?? '') : t('directory.picker.locked')}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          )}
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
