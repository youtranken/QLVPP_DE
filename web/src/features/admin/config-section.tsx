import { useId } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDisabledReason } from '@/ui/disabled-reason';
import type { ConfigBlockState } from './use-config-block';

export function ConfigSection({
  title,
  description,
  saveLabel,
  state,
  children,
}: {
  title: string;
  description?: string;
  saveLabel: string;
  state: Pick<ConfigBlockState<unknown>, 'errors' | 'status' | 'dirty' | 'invalid' | 'save' | 'cancel'>;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const saving = state.status === 'saving';
  const fix = useDisabledReason(state.invalid ? t('common.disabledReason.fixErrors') : null);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    void state.save().then(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  };
  return (
    <form className="cf-block" data-dirty={state.dirty || undefined} aria-labelledby={titleId} onSubmit={submit} noValidate>
      <header className="cf-block__head">
        <h2 id={titleId}>{title}</h2>
        {description && <p>{description}</p>}
      </header>
      {state.errors.form && (
        <p role="alert" className="alert alert--danger">
          {t(state.errors.form)}
        </p>
      )}
      <div className="cf-block__body">{children}</div>
      <footer className="cf-block__foot">
        <span role="status" className="cf-block__status">
          {saving ? t('config.saving') : state.status === 'saved' ? t('config.saved') : null}
        </span>
        {state.dirty && !saving && (
          <button type="button" className="btn btn--ghost" onClick={state.cancel}>
            {t('config.cancel')}
          </button>
        )}
        <button type="submit" className={state.dirty ? 'btn btn--primary' : 'btn'} disabled={saving || !state.dirty || state.invalid} aria-describedby={fix.describedBy}>
          {saving ? t('config.saving') : state.dirty ? saveLabel : t('config.page.noChanges')}
        </button>
        {fix.node}
        <p className="cf-block__note">{t('config.page.saveNote')}</p>
      </footer>
    </form>
  );
}
