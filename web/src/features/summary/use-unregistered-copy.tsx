import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { vnDeadlineDay } from '@/lib/format-time';
import { useToast } from '@/ui/toast-context';
import { monthOf } from '@/features/request/request-format';
import { ManualCopyDialog } from './manual-copy-dialog';
import { fetchUnregistered, type UnregisteredUser } from './summary.api';

// Văn bản dán cho nhân viên (nhóm chat) luôn tiếng Việt, bất kể ngôn ngữ giao diện của Hành chính
function useCopyText(ym: string, deadline: string | null) {
  const { i18n } = useTranslation();
  const t = i18n.getFixedT('vi');
  return (users: UnregisteredUser[]) => {
    const month = monthOf(ym);
    const header = deadline
      ? t('summary.unregistered.copy.header', { month, day: vnDeadlineDay(deadline) })
      : t('summary.unregistered.copy.headerNoDeadline', { month });
    const lines = users.map((u) => {
      const name = u.full_name ?? u.email ?? u.sub;
      return u.department ? `- ${name} (${u.department})` : `- ${name}`;
    });
    return [header, ...lines].join('\n');
  };
}

// Clipboard API cần HTTPS/quyền; thiếu thì hiện văn bản đã chọn sẵn để người dùng tự sao chép
async function tryClipboard(text: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function useUnregisteredCopy(ym: string, deadline: string | null) {
  const { t } = useTranslation();
  const toast = useToast();
  const toText = useCopyText(ym, deadline);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [manual, setManual] = useState<string | null>(null);

  const copy = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const { items } = await fetchUnregistered(ym);
      const text = toText(items);
      if (await tryClipboard(text)) toast.show({ text: t('summary.unregistered.copy.done', { n: items.length }) });
      else setManual(text);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const feedback = (
    <>
      {failed && (
        <span role="alert" className="sm-copy-error">
          {t('summary.unregistered.copy.failed')}
        </span>
      )}
      {manual !== null && <ManualCopyDialog text={manual} onClose={() => setManual(null)} />}
    </>
  );
  return { copy: () => void copy(), busy, feedback };
}
