import { Fragment, useId, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { FormField } from '@/ui/form-field';
import { LoadError, Loading } from '@/ui/load-state';
import { CONFIG_KEY, saveConfig, useAdminConfig, type AdminConfig } from '@/features/admin/admin.api';
import { configErrorField } from '@/features/admin/admin-errors';
import {
  GROUP_FIELDS,
  SIGN_FIELDS,
  boxLabel,
  errorsFromApiField,
  toDraft,
  toPatch,
  validateGroup,
  type ConfigErrors,
  type ConfigGroup,
  type DraftField,
} from '@/features/admin/config-form';
import { ConfigSection } from '@/features/admin/config-section';
import '@/features/admin/admin.css';

const NUMBER_INPUT: InputHTMLAttributes<HTMLInputElement> = { type: 'number', inputMode: 'numeric', step: 1 };

export function ConfigPage() {
  const config = useAdminConfig();
  if (config.isError) return <LoadError onRetry={() => void config.refetch()} />;
  if (!config.data) return <Loading />;
  return <ConfigForm config={config.data} />;
}

function ConfigForm({ config }: { config: AdminConfig }) {
  const { t, i18n } = useTranslation();
  const { csrfToken } = useMe();
  const qc = useQueryClient();
  const [draft, setDraft] = useState(() => toDraft(config));
  const [errors, setErrors] = useState<ConfigErrors>({});
  const [formError, setFormError] = useState<{ group: ConfigGroup; key: string } | null>(null);
  const [saving, setSaving] = useState<ConfigGroup | null>(null);
  const [saved, setSaved] = useState<ConfigGroup | null>(null);
  const base = toDraft(config);
  const patchOf = (group: ConfigGroup) => toPatch(group, draft, base, config.signature_boxes);

  const save = async (group: ConfigGroup) => {
    const fields = GROUP_FIELDS[group];
    const patch = patchOf(group);
    if (Object.keys(patch).length === 0) return;
    const invalid = validateGroup(group, draft);
    setErrors((prev) => ({ ...Object.fromEntries(Object.entries(prev).filter(([k]) => !fields.includes(k as DraftField))), ...invalid }));
    setSaved(null);
    setFormError(null);
    if (Object.keys(invalid).length > 0) return;
    setSaving(group);
    try {
      const next = await saveConfig(patch, csrfToken);
      qc.setQueryData(CONFIG_KEY, next);
      void qc.invalidateQueries({ queryKey: ['public-config'] });
      const fresh = toDraft(next);
      // Chỉ nạp lại ô của nhóm vừa lưu để không xóa phần đang sửa ở nhóm khác
      setDraft((d) => ({ ...d, ...Object.fromEntries(fields.map((f) => [f, fresh[f]])) }));
      setSaved(group);
    } catch (e) {
      const apiErrors = errorsFromApiField(configErrorField(e));
      if (apiErrors.form) setFormError({ group, key: apiErrors.form });
      else setErrors((prev) => ({ ...prev, ...apiErrors }));
    } finally {
      setSaving(null);
    }
  };

  const edit = (f: DraftField, value: string) => {
    setDraft((d) => ({ ...d, [f]: value }));
    setErrors(({ [f]: _cleared, ...rest }) => rest);
  };

  const field = (f: DraftField, label: string, hint?: string, extra?: InputHTMLAttributes<HTMLInputElement>) => (
    <FormField label={label} hint={hint} error={errors[f] ? t(errors[f]) : undefined}>
      {(p) => (
        <input {...p} {...extra} value={draft[f]} onChange={(e) => edit(f, e.target.value)} />
      )}
    </FormField>
  );

  const section = (group: ConfigGroup) => ({
    saveLabel: t(`config.${group}.save`),
    saving: saving === group,
    canSave: Object.keys(patchOf(group)).length > 0,
    saved: saved === group,
    formError: formError?.group === group ? t(formError.key) : undefined,
    onSave: () => void save(group),
  });

  return (
    <div className="a-stack config-page">
      <ConfigSection title={t('config.period.title')} note={t('config.period.note')} {...section('period')}>
        {field('registration_last_day', t('config.period.lastDay'), t('config.period.lastDayHint'), { ...NUMBER_INPUT, min: 3, max: 28 })}
        {field('default_max_qty', t('config.period.defaultMax'), t('config.period.defaultMaxHint'), { ...NUMBER_INPUT, min: 1, max: 999 })}
      </ConfigSection>
      <ConfigSection title={t('config.access.title')} {...section('access')}>
        {field('admin_group', t('config.access.adminGroup'), t('config.access.adminGroupHint'), { maxLength: 200 })}
        <AuthorizedGroups groups={config.authorized_groups} />
      </ConfigSection>
      <ConfigSection title={t('config.signers.title')} note={t('config.signers.hint')} {...section('signers')}>
        {config.signature_boxes.map((box, i) => (
          <Fragment key={SIGN_FIELDS[i]}>{field(SIGN_FIELDS[i], boxLabel(box, i18n.language), undefined, { maxLength: 200 })}</Fragment>
        ))}
      </ConfigSection>
      <ConfigSection title={t('config.contact.title')} {...section('contact')}>
        {field('admin_contact', t('config.contact.adminContact'), t('config.contact.adminContactHint'), { maxLength: 500 })}
      </ConfigSection>
    </div>
  );
}

// Chỉ đồng bộ danh bạ ghi được khóa này (server từ chối khi PUT), nên chỉ hiện để đọc
function AuthorizedGroups({ groups }: { groups: string[] }) {
  const { t } = useTranslation();
  const labelId = useId();
  return (
    <div className="ff config-readonly">
      <span id={labelId} className="ff-label">
        {t('config.access.authorizedGroups')}
      </span>
      {groups.length > 0 ? (
        <ul className="tag-list" aria-labelledby={labelId}>
          {groups.map((g) => (
            <li key={g} className="tag">
              {g}
            </li>
          ))}
        </ul>
      ) : (
        <p>{t('config.access.noGroups')}</p>
      )}
      <p className="ff-hint">{t('config.access.authorizedGroupsHint')}</p>
    </div>
  );
}
