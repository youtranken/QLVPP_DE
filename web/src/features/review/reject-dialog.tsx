import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { apiErrorCode } from '@/lib/api-error';
import { Dialog, DialogClose, DialogCloseButton, DialogTitle } from '@/ui/dialog';
import { FormField } from '@/ui/form-field';
import { reviewErrorKey } from './review-errors';

const REASON_MIN = 3;
const NOTE_MAX = 500;

// Ô lý do riêng của Từ chối, không dùng chung với lý do điều chỉnh phiếu
export function RejectDialog({ name, onSubmit, onClose }: {
  name: string;
  onSubmit: (note: string) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ field: 'reason' | 'form'; key: string } | null>(null);
  const note = reason.trim();
  const canSubmit = note.length >= REASON_MIN && !saving;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      await onSubmit(note);
    } catch (err) {
      const code = apiErrorCode(err);
      const onReason = code === 'REASON_REQUIRED' || code === 'VALIDATION';
      setError({
        field: onReason ? 'reason' : 'form',
        key: code === 'VALIDATION' ? 'review.errors.REASON_REQUIRED' : (reviewErrorKey(err) ?? 'review.errors.UNKNOWN'),
      });
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} dirty={reason !== ''} dismissible={!saving} className="sheet a-form" maxWidth={480}>
      <form onSubmit={submit} noValidate>
        <div className="sheet-header">
          <DialogTitle className="sheet-title">{t('review.reject.title', { name })}</DialogTitle>
          <DialogCloseButton disabled={saving} />
        </div>
        <div className="sheet-body">
          {error?.field === 'form' && (
            <p role="alert" className="alert alert--danger">
              {t(error.key)}
            </p>
          )}
          <FormField
            label={t('review.reject.reason')}
            required
            hint={t('review.reject.hint')}
            error={error?.field === 'reason' ? t(error.key) : undefined}
          >
            {(p) => (
              <textarea
                {...p}
                rows={3}
                maxLength={NOTE_MAX}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setError(null);
                }}
              />
            )}
          </FormField>
        </div>
        <div className="sheet-footer">
          <DialogClose asChild>
            <button type="button" className="btn btn--ghost" disabled={saving}>
              {t('review.back')}
            </button>
          </DialogClose>
          <button type="submit" className="btn btn--danger btn--solid" disabled={!canSubmit}>
            {saving ? t('review.saving') : t('review.reject.submit')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
