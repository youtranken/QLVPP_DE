import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { OwedPeriod } from './request.api';
import { monthOf, useRequestFormat } from './request-format';

// Mọi kỳ đã khóa còn phần chưa giao: nhắc nhân viên khỏi đăng ký lại; một món thì ghi tên, nhiều món thì đếm
export function OwedNotice({ owed = [] }: { owed?: OwedPeriod[] }) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  if (owed.length === 0) return null;
  const list = owed
    .map((p) => {
      const what =
        p.lines.length === 1
          ? t('request.hero.owedOne', { name: fmt.name(p.lines[0]), qty: p.lines[0].qty })
          : t('request.hero.owedMany', { k: p.items });
      return t('request.hero.owedMonth', { month: monthOf(p.ym), what });
    })
    .join(' · ');
  const to = owed.length === 1 ? `/history/${owed[0].ym}` : '/history';
  return (
    <div className="rq-owed">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6zM14 3v6h6" />
      </svg>
      <p>{t('request.hero.owed', { list })}</p>
      <Link to={to}>{t('request.hero.owedView')}</Link>
    </div>
  );
}
