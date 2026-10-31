import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { vnDeadlineDay } from '@/lib/format-time';
import { Dialog, DialogClose, DialogDescription, DialogTitle } from '@/ui/dialog';
import { Icon } from '@/ui/icon';
import { useToast } from '@/ui/toast-context';
import { monthOf } from '@/features/request/request-format';
import { fetchUnregistered, type UnregisteredUser } from './summary.api';

interface UnregisteredCopyProps {
  ym: string;
  deadline: string | null;
  count: number;
}

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

function ManualCopyDialog({ text, onClose }: { text: string; onClose: () => void }) {
  const { t } = useTranslation();
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => box.current?.select(), []);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} maxWidth={520}>
      <div className="sheet-header">
        <DialogTitle className="sheet-title">{t('summary.unregistered.copy.dialogTitle')}</DialogTitle>
        <DialogClose asChild>
          <button type="button" className="sheet-close" aria-label={t('common.close')}>
            <Icon name="x" />
          </button>
        </DialogClose>
      </div>
      <div className="sheet-body">
        <DialogDescription>{t('summary.unregistered.copy.dialogHint')}</DialogDescription>
        <textarea
          ref={box}
          autoFocus
          className="sm-copy-text"
          readOnly
          rows={8}
          value={text}
          aria-label={t('summary.unregistered.copy.dialogTitle')}
          onFocus={(e) => e.currentTarget.select()}
        />
      </div>
      <div className="sheet-footer">
        <button type="button" className="btn" onClick={onClose}>
          {t('summary.unregistered.copy.close')}
        </button>
      </div>
    </Dialog>
  );
}

export function UnregisteredCopy({ ym, deadline, count }: UnregisteredCopyProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const toText = useCopyText(ym, deadline);
  const hintId = useId();
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

  return (
    <span className="sm-copy">
      <button
        type="button"
        className="btn"
        disabled={busy || count === 0}
        aria-describedby={count === 0 ? hintId : undefined}
        onClick={() => void copy()}
      >
        <Icon name="copy" size={18} />
        {t('summary.unregistered.copy.button', { n: count })}
      </button>
      {count === 0 && (
        <span id={hintId} className="sm-note">
          {t('summary.unregistered.allDone')}
        </span>
      )}
      {failed && (
        <span role="alert" className="sm-copy-error">
          {t('summary.unregistered.copy.failed')}
        </span>
      )}
      {manual !== null && <ManualCopyDialog text={manual} onClose={() => setManual(null)} />}
    </span>
  );
}
