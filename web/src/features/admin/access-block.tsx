import { useId } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDirectoryUsers } from '@/features/directory/use-all-users';
import { nameOf } from '@/features/directory/users-rows';

// Chỉ đọc: PMH ID quyết định ai được vào và ai là Hành chính; khối này chỉ liệt kê kết quả đã đồng bộ
export function AccessBlock() {
  const { t } = useTranslation();
  const labelId = useId();
  const directory = useDirectoryUsers('');
  const ready = !directory.loading && !directory.failed && !directory.overflow;
  const admins = ready ? directory.users.filter((u) => u.role === 'admin') : null;
  return (
    <section className="cf-block" aria-labelledby={`${labelId}-h`}>
      <header className="cf-block__head">
        <h2 id={`${labelId}-h`}>{t('config.access.title')}</h2>
        <p>{t('config.access.scope')}</p>
      </header>
      <div className="cf-block__body cf-readonly">
        <span id={labelId} className="ff-label">
          {t('config.access.adminsTitle')}
        </span>
        {admins === null ? (
          !directory.loading && <p className="ff-hint">{t('config.access.adminsUnknown')}</p>
        ) : admins.length > 0 ? (
          <ul className="cf-tags" aria-labelledby={labelId}>
            {admins.map((u) => (
              <li key={u.sub} className="tag">
                {nameOf(u)}
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('config.access.noAdmins')}</p>
        )}
        <p className="ff-hint">
          {t('config.access.adminsHint')} <Link to="/admin/users">{t('config.access.openDirectory')}</Link>
        </p>
      </div>
    </section>
  );
}
