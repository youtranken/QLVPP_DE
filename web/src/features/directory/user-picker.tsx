import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { userLabel, type DirectoryUser } from '@/features/directory/directory.api';
import { useDirectoryUsers } from '@/features/directory/use-all-users';
import { matchesSearch } from '@/features/request/request-format';
import { SearchClear } from '@/ui/search-clear';
import '@/features/directory/user-picker.css';

const SEARCH_DEBOUNCE_MS = 250;
const SHOWN = 8;

const describe = (u: DirectoryUser) => [userLabel(u), u.department ?? u.email].filter(Boolean).join(' · ');

// Danh bạ vừa tải hết thì lọc tại chỗ bằng hàm bỏ dấu (Hành chính quen gõ "nguyen van an"); danh bạ quá lớn thì server đã lọc
function usePickerResults(search: string, allowLocked: boolean) {
  const d = useDirectoryUsers(search);
  const q = search.trim();
  const hit = (u: DirectoryUser) => d.overflow || matchesSearch([u.fullName, u.email, u.department].filter(Boolean).join(' '), q);
  // Người đã khóa không chọn được ở Xuất lẻ nên không hiện; lọc Nhật ký vẫn tìm được người đã nghỉ
  const usable = (u: DirectoryUser) => allowLocked || u.status === 'active';
  const items = q === '' && !d.overflow ? d.users.filter(usable) : d.users.filter((u) => usable(u) && hit(u));
  return { items: items.slice(0, SHOWN), loading: d.loading };
}

// Mặc định chỉ người đang hoạt động mới chọn được (server vẫn kiểm USER_INACTIVE); lọc nhật ký thì cho chọn cả người đã khóa
export function UserPicker({
  label,
  searchLabel,
  value,
  error,
  hint,
  allowLocked = false,
  resultsWhenEmpty = true,
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const users = usePickerResults(search, allowLocked);
  const listing = resultsWhenEmpty || search.trim() !== '';

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
        <div className="user-picker-field">
          <span className="search-wrap">
            <input
              ref={inputRef}
              className="a-input"
              type="search"
              aria-label={searchLabel}
              placeholder={t('directory.picker.searchHint')}
              aria-describedby={note ? noteId : undefined}
              aria-invalid={error ? true : undefined}
              aria-required={required || undefined}
              value={text}
              onChange={(e) => setText(e.target.value)}
              // Ô tìm hay nằm trong form khác (xuất lẻ): Enter không tự gửi form, chỉ form nào muốn mới nhận qua onEnter
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                onEnter?.();
              }}
            />
            <SearchClear className="search-box-x" value={text} onClear={() => setText('')} inputRef={inputRef} />
          </span>
          <p className="sr-only" role="status">
            {listing && !users.loading ? t('directory.picker.count', { count: users.items.length }) : ''}
          </p>
          {listing && (
            <ul className="user-picker-list" aria-label={t('directory.picker.results')} aria-busy={users.loading}>
              {!users.loading && users.items.length === 0 && <li className="user-picker-empty">{t('directory.picker.empty')}</li>}
              {users.items.map((u) => (
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
        </div>
      )}
      {note && (
        <p id={noteId} className={error ? 'ff-error' : 'ff-hint'}>
          {note}
        </p>
      )}
    </fieldset>
  );
}
