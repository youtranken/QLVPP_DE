import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { FormField } from '@/ui/form-field';
import { Switch } from '@/ui/switch';
import { useLowStock } from '@/features/stock/stock.api';
import type { ContactDraft } from './config-form';
import { ConfigSection } from './config-section';
import type { ConfigBlockState } from './use-config-block';

const CONTACT_MAX = 500;

export function ContactBlock({ state }: { state: ConfigBlockState<ContactDraft> }) {
  const { t } = useTranslation();
  const low = useLowStock();
  const countId = useId();
  const { draft, errors, update } = state;
  return (
    <ConfigSection title={t('config.contact.title')} saveLabel={t('config.contact.save')} state={state}>
      <FormField
        label={t('config.contact.adminContact')}
        hint={t('config.contact.adminContactHint')}
        error={errors.admin_contact ? t(errors.admin_contact) : undefined}
        counter={{ value: draft.admin_contact.length, max: CONTACT_MAX }}
      >
        {(p) => (
          <textarea
            {...p}
            rows={3}
            maxLength={CONTACT_MAX}
            value={draft.admin_contact}
            onChange={(e) => update((d) => ({ ...d, admin_contact: e.target.value }), 'admin_contact')}
          />
        )}
      </FormField>
      <div className="cf-switch">
        <Switch
          checked={draft.low_stock_notify}
          text={t('config.contact.lowStock')}
          describedBy={countId}
          onChange={(next) => update((d) => ({ ...d, low_stock_notify: next }))}
        />
        <p id={countId} className="ff-hint">
          {t('config.contact.lowStockHint')}
          {low.data && <> {t('config.contact.lowStockCount', { count: low.data.length })}</>}
        </p>
      </div>
    </ConfigSection>
  );
}
