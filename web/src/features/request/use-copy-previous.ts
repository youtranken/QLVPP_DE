import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useConfirm } from '@/ui/confirm-context';
import { useCopyPreviousQuery, type CopyPreviousResult } from './request.api';
import { monthOf } from './request-format';
import type { Cart } from './use-cart';
import type { SaveFlow } from './use-save-flow';

export const hasCopyNotes = (r: CopyPreviousResult) =>
  r.skipped.length + r.capped.length + r.previously_accepted.length > 0;

// Chép vào giỏ (chưa lưu); giỏ đang có dòng của mình thì hỏi trước khi thay
export function useCopyPrevious(ym: string, cart: Cart, flow: SaveFlow) {
  const { t } = useTranslation();
  const me = useMe();
  const ask = useConfirm();
  const query = useCopyPreviousQuery(ym, me.csrfToken);
  const [summary, setSummary] = useState<CopyPreviousResult | null>(null);
  const [busy, setBusy] = useState(false);
  const fromYm = query.data?.from_ym ?? null;

  const run = async () => {
    const own = cart.lines.filter((l) => !l.readonly).length;
    if (own > 0 && fromYm) {
      const ok = await ask({
        title: t('request.copy.askTitle'),
        message: t('request.copy.askBody', { n: own, month: monthOf(fromYm) }),
        confirmLabel: t('request.copy.replace'),
        cancelLabel: t('request.copy.keep'),
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const { data, isError } = await query.refetch();
      if (isError || !data) {
        if (isError) flow.showError(t('request.copy.failed'));
        return;
      }
      flow.clearErrors();
      cart.replaceAll(data.lines);
      if (hasCopyNotes(data)) setSummary(data);
      else flow.showToast(t('request.copy.toast', { month: monthOf(data.from_ym) }));
    } finally {
      setBusy(false);
    }
  };

  return { fromYm, busy, run, summary, closeSummary: () => setSummary(null) };
}
