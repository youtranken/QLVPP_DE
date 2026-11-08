import { useTranslation } from 'react-i18next';
import { adjustReasonText } from '@/lib/adjust-reason';
import { vnSavedStamp } from '@/lib/format-time';
import type { RequestView } from './request.api';
import { nameIn } from './request-format';

interface Entry {
  key: string;
  at: string;
  name: string;
  before: number;
  after: number;
  reason: string;
}

// Mọi lần Hành chính giảm/bỏ món của phiếu, theo thời gian
function entriesOf(view: RequestView, t: ReturnType<typeof useTranslation>['t'], lang: string): Entry[] {
  const fromLines = view.lines.flatMap((l) =>
    (l.adjustments ?? []).map<Entry>((a, i) => ({
      key: `${l.id}-${i}`,
      at: a.at,
      name: l.item ? nameIn(l.item, lang) : (l.custom_name ?? ''),
      before: a.before,
      after: a.after,
      reason: adjustReasonText(t, a.reason_code, a.reason_note),
    })),
  );
  const fromRemoved = (view.removed_lines ?? []).map<Entry>((r, i) => ({
    key: `removed-${i}-${r.at}`,
    at: r.at,
    name: nameIn(r, lang),
    before: r.before,
    after: 0,
    reason: adjustReasonText(t, r.reason_code, r.reason_note),
  }));
  return [...fromLines, ...fromRemoved].sort((a, b) => a.at.localeCompare(b.at));
}

export function AdjustmentsBlock({ view }: { view: RequestView }) {
  const { t, i18n } = useTranslation();
  const entries = entriesOf(view, t, i18n.language);
  if (entries.length === 0) return null;
  return (
    <section className="hs-adjust-box" aria-labelledby="hs-adjust-title">
      <h3 id="hs-adjust-title" className="hs-adjust-title">
        {t('request.history.adjustTitle')}
      </h3>
      <ul className="hs-adjusts">
        {entries.map((e) => (
          <li key={e.key} className="hs-adjust">
            {t('request.history.adjustLine', { at: vnSavedStamp(e.at), name: e.name, before: e.before, after: e.after, reason: e.reason })}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RemovedAllNote({ view }: { view: RequestView }) {
  const { t } = useTranslation();
  const reasons = [...new Set((view.removed_lines ?? []).map((l) => adjustReasonText(t, l.reason_code, l.reason_note)))];
  return <p className="hs-adjust hs-removed-all">{t('request.history.removedAll', { reasons: reasons.join('; ') })}</p>;
}
