import { useId } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export function ConfigSection({
  title,
  note,
  saveLabel,
  saving,
  saved,
  formError,
  onSave,
  children,
}: {
  title: string;
  note?: string;
  saveLabel: string;
  saving: boolean;
  saved: boolean;
  formError?: string;
  onSave: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave();
  };
  return (
    <form className="a-panel config-section" aria-labelledby={titleId} onSubmit={submit} noValidate>
      <h2 id={titleId} className="config-title">
        {title}
      </h2>
      {note && <p className="config-note">{note}</p>}
      {formError && (
        <p role="alert" className="alert alert--danger">
          {formError}
        </p>
      )}
      <div className="config-fields">{children}</div>
      <div className="config-actions">
        {saved && (
          <p role="status" className="config-saved">
            {t('config.saved')}
          </p>
        )}
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? t('config.saving') : saveLabel}
        </button>
      </div>
    </form>
  );
}
