import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { formatVnStamp } from '@/lib/format-time';
import { FormField } from '@/ui/form-field';
import { ADJUST_REASONS } from './summary.api';
import { NOTE_MAX, noteLength, type Adjust, type LineReason } from './use-adjust';
import type { LineView } from '@/features/request/request.api';

// W11 (R-D17.6): kỳ đã có bản gửi ADM → giảm bây giờ thì phần giảm về dư vào kho; không chặn Lưu
function SentWarning({ sentAt, n, unit }: { sentAt: string; n: number; unit: string }) {
  const { t } = useTranslation();
  return <p className="alert alert--warn aj-w11">{t('warn.W11', { time: formatVnStamp(sentAt), n, unit })}</p>;
}

// Khối "Vì sao giảm?" của một dòng (R-D6.14): chỉ hiện khi số mới < số cũ; ẩn thì nháp vẫn giữ trong use-adjust
function ReasonBlock({ reason, onChange, reuse }: { reason: LineReason; onChange: (r: LineReason) => void; reuse?: () => void }) {
  const { t } = useTranslation();
  const id = useId();
  const other = reason.code === 'other';
  return (
    <div className="aj-why">
      <span id={`${id}-label`} className="aj-why__label">
        {t('summary.adjust.lineReason')}
      </span>
      <div role="radiogroup" aria-labelledby={`${id}-label`} className="aj-why__chips">
        {ADJUST_REASONS.map((code) => (
          <label key={code} className="aj-chip">
            <input type="radio" name={`${id}-reason`} checked={reason.code === code} onChange={() => onChange({ ...reason, code })} />
            <span>{t(`adjustReason.${code}`)}</span>
          </label>
        ))}
      </div>
      <FormField
        label={t('summary.adjust.lineNote')}
        required={other}
        hint={other ? t('summary.adjust.lineNoteRequired') : undefined}
        counter={{ value: noteLength(reason.note), max: NOTE_MAX }}
      >
        {(control) => (
          <textarea
            {...control}
            className="aj-why__note"
            rows={2}
            value={reason.note}
            placeholder={t('summary.adjust.lineNotePlaceholder')}
            onChange={(e) => onChange({ ...reason, note: e.target.value })}
          />
        )}
      </FormField>
      {reuse && (
        <button type="button" className="btn btn--sm btn--ghost aj-why__reuse" onClick={reuse}>
          {t('summary.adjust.reuseReason')}
        </button>
      )}
    </div>
  );
}

// Phần dưới dòng đang giảm: cảnh báo đã gửi ADM rồi khối lý do
export function LineReduce({ a, line, unit }: { a: Adjust; line: LineView; unit: string }) {
  if (!a.isReduced(line)) return null;
  const n = line.qty - a.qtyOf(line);
  return (
    <>
      {a.sentAt && <SentWarning sentAt={a.sentAt} n={n} unit={unit} />}
      <ReasonBlock
        reason={a.reasonOf(line)}
        onChange={(r) => a.edit.setReason(line.id, r)}
        reuse={a.reuseFrom === line.id ? a.reuse : undefined}
      />
    </>
  );
}
