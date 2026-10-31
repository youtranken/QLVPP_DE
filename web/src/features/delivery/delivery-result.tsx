import { useTranslation } from 'react-i18next';
import { outcomeText, type DeliveryOutcome } from './delivery-outcome';

export function DeliveryResult({ outcome }: { outcome: DeliveryOutcome }) {
  const { t } = useTranslation();
  const tone = outcome.failed.length > 0 ? 'alert--warn' : 'alert--ok';
  return (
    <p role="status" aria-label={t('delivery.result.label')} className={`alert ${tone} dv-result`}>
      {outcomeText(outcome, t)}
    </p>
  );
}
