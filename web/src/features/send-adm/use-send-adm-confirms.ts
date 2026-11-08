import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfirm, type ConfirmOptions } from '@/ui/confirm-context';

export function useLeavePrompt(n: number): ConfirmOptions {
  const { t } = useTranslation();
  return useMemo(
    () => ({ title: t('sendAdm.leave.title'), message: t('sendAdm.leave.body', { n }), confirmLabel: t('sendAdm.leave.discard'), cancelLabel: t('sendAdm.leave.stay'), danger: true }),
    [t, n],
  );
}

export function useNoOrderConfirm() {
  const { t } = useTranslation();
  const ask = useConfirm();
  return () => ask({ title: t('sendAdm.noOrder.title'), message: t('sendAdm.noOrder.body'), confirmLabel: t('sendAdm.noOrder.ok'), cancelLabel: t('sendAdm.noOrder.back') });
}
