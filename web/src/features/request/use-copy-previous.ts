import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useConfirm } from '@/ui/confirm-context';
import { useCopyPreviousQuery, type CopyPreviousResult } from './request.api';
import { monthOf } from './request-format';
import type { Cart, ReplaceReport } from './use-cart';
import type { SaveFlow } from './use-save-flow';

const NO_REPORT: ReplaceReport = { heldByAdmin: [], unavailable: 0 };

export const hasCopyNotes = (r: CopyPreviousResult, report: ReplaceReport = NO_REPORT) =>
  r.skipped.length + r.capped.length + r.previously_accepted.length + report.heldByAdmin.length + report.unavailable > 0;

export interface CopySummary {
  result: CopyPreviousResult;
  report: ReplaceReport;
}

// Chép vào giỏ (chưa lưu); giỏ đang có dòng của mình thì hỏi trước khi thay
export function useCopyPrevious(ym: string, cart: Cart, flow: SaveFlow) {
  const { t } = useTranslation();
  const me = useMe();
  const ask = useConfirm();
  const query = useCopyPreviousQuery(ym, me.csrfToken);
  const [summary, setSummary] = useState<CopySummary | null>(null);
  const [busy, setBusy] = useState(false);
  const fromYm = query.data?.from_ym ?? null;

  const run = async () => {
    const own = cart.lines.filter((l) => !l.readonly).length;
    if (own > 0 && fromYm) {
      const ok = await ask({
        title: t('request.copy.askTitle'),
        message: t('request.copy.askBody', { count: own, month: monthOf(fromYm) }),
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
      const report = cart.replaceAll(data.lines);
      if (hasCopyNotes(data, report)) setSummary({ result: data, report });
      else flow.showToast(t('request.copy.toast', { month: monthOf(data.from_ym) }));
    } finally {
      setBusy(false);
    }
  };

  return { fromYm, busy, run, summary, closeSummary: () => setSummary(null) };
}
