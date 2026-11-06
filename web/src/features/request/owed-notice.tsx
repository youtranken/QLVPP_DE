import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMyRequest, type CurrentPeriod } from './request.api';
import { counted, monthOf, owedQty, useRequestFormat } from './request-format';

// Kỳ trước đang giao mà còn dòng chưa nhận hết: nhắc nhân viên khỏi đăng ký lại
export function OwedNotice({ previous }: { previous: CurrentPeriod['previous'] }) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const delivering = !!previous?.delivering;
  const request = useMyRequest(delivering ? previous!.ym : undefined);
  if (!delivering || !request.data) return null;
  const owed = request.data.lines.filter((l) => counted(l) && owedQty(l) > 0);
  if (owed.length === 0) return null;
  const only = owed[0];
  const what =
    owed.length === 1
      ? `${fmt.name(only.item ?? { name: only.custom_name ?? '', name_en: null })} (${owedQty(only)} ${fmt.unit(only.item?.unit ?? only.custom_unit)})`
      : t('request.hero.owedMany', { k: owed.length });
  const ym = previous!.ym;
  return (
    <div className="rq-owed">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6zM14 3v6h6" />
      </svg>
      <p>
        {t('request.hero.owedBefore')}
        <strong>{what}</strong>
        {t('request.hero.owedAfter', { month: monthOf(ym) })}
      </p>
      <Link to={`/history/${ym}`}>{t('request.hero.owedView')}</Link>
    </div>
  );
}
