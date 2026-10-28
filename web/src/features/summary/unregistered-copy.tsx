import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogDescription, DialogTitle } from '@/ui/dialog';
import { monthOf, useRequestFormat } from '@/features/request/request-format';
import { fetchUnregistered, type UnregisteredUser } from './summary.api';

interface UnregisteredCopyProps {
  ym: string;
  deadline: string | null;
  count: number;
}

type Notice = { kind: 'ok' | 'error'; text: string } | null;

// Văn bản dán cho nhân viên (Zalo) luôn tiếng Việt, bất kể ngôn ngữ giao diện của Hành chính
function useCopyText(ym: string, deadline: string | null) {
  const { i18n } = useTranslation();
  const t = i18n.getFixedT('vi');
  const fmt = useRequestFormat();
  return (users: UnregisteredUser[]) => {
    const month = monthOf(ym);
    const header = deadline
      ? t('summary.copy.header', { month, day: fmt.lastDay(deadline) })
      : t('summary.copy.headerNoDeadline', { month });
    const lines = users.map((u) => {
      const name = u.full_name ?? u.email ?? u.sub;
      return u.department ? `- ${name} — ${u.department}` : `- ${name}`;
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
        <DialogTitle className="sheet-title">{t('summary.copy.dialogTitle')}</DialogTitle>
      </div>
      <div className="sheet-body">
        <DialogDescription>{t('summary.copy.dialogHint')}</DialogDescription>
        <textarea
          ref={box}
          className="sm-copy-text"
          readOnly
          rows={8}
          value={text}
          aria-label={t('summary.copy.dialogTitle')}
          onFocus={(e) => e.currentTarget.select()}
        />
      </div>
      <div className="sheet-footer">
        <button type="button" className="btn" onClick={onClose}>
          {t('summary.copy.close')}
        </button>
      </div>
    </Dialog>
  );
}

export function UnregisteredCopy({ ym, deadline, count }: UnregisteredCopyProps) {
  const { t } = useTranslation();
  const toText = useCopyText(ym, deadline);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [manual, setManual] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(id);
  }, [notice]);

  const copy = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const { items } = await fetchUnregistered(ym);
      const text = toText(items);
      if (await tryClipboard(text)) setNotice({ kind: 'ok', text: t('summary.copy.done', { n: items.length }) });
      else setManual(text);
    } catch {
      setNotice({ kind: 'error', text: t('summary.copy.failed') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sm-copy">
      <button type="button" className="btn" disabled={busy || count === 0} onClick={() => void copy()}>
        {t('summary.copy.button', { n: count })}
      </button>
      <span className={`sm-copy-notice${notice?.kind === 'error' ? ' is-error' : ''}`} role="status" aria-live="polite">
        {notice?.text}
      </span>
      {manual !== null && <ManualCopyDialog text={manual} onClose={() => setManual(null)} />}
    </div>
  );
}
