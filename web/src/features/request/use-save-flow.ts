import { useEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { saveMyLines, useSetMyRequest, type RequestView } from './request.api';
import { saveFailure } from './request-errors';
import { monthOf, useAdminContact } from './request-format';
import { carryOf, type Cart, type ReplaceLineInput } from './use-cart';

const TOAST_MS = 3000;

// Mỗi lần lưu hỏng là một object mới → effect focus chạy lại cả khi cùng một lỗi
export interface Notice {
  text: string;
  focusKey: string | null;
  tone: 'danger' | 'info';
}

export interface SaveFlowOptions {
  // Kỳ vừa khóa: trang chuyển sang kỳ mới, mang giỏ theo
  onLocked: (nextYm: string, carry: ReplaceLineInput[]) => void;
  initialNotice?: Notice | null;
}

// Giỏ ở 390 px nằm dưới lưới: lỗi lưu phải hiện cạnh thanh lưu và đưa focus tới chỗ cần sửa
function useFocusNotice(notice: Notice | null, cartRef: RefObject<HTMLElement | null>, noticeRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!notice) return;
    const row = notice.focusKey
      ? [...(cartRef.current?.querySelectorAll<HTMLElement>('[data-line-key]') ?? [])].find(
          (el) => el.dataset.lineKey === notice.focusKey,
        )
      : undefined;
    const target = row ? (row.querySelector<HTMLElement>('input') ?? row) : noticeRef.current;
    target?.scrollIntoView?.({ block: 'center' });
    target?.focus({ preventScroll: true });
  }, [notice, cartRef, noticeRef]);
}

export function lockedNotice(t: (k: string, o?: Record<string, unknown>) => string, ym: string, next: string): Notice {
  return { text: t('request.locked', { month: monthOf(ym), next: monthOf(next) }), focusKey: null, tone: 'info' };
}

export function useSaveFlow(
  cart: Cart,
  ym: string,
  refetch: () => Promise<RequestView | null | undefined>,
  cartRef: RefObject<HTMLElement | null>,
  opts: SaveFlowOptions,
) {
  const { t } = useTranslation();
  const me = useMe();
  const contact = useAdminContact();
  const setMyRequest = useSetMyRequest();
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stale, setStale] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice | null>(opts.initialNotice ?? null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const month = monthOf(ym);

  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useFocusNotice(notice, cartRef, noticeRef);

  const fail = (text: string, focusKey: string | null = null) => {
    clearTimeout(toastTimer.current);
    setToast(null);
    setNotice({ text, focusKey, tone: 'danger' });
  };

  const showToast = (text: string) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  };

  const save = async () => {
    setSaving(true);
    try {
      const { request } = await saveMyLines(cart.toBody(), me.csrfToken);
      cart.markSaved(request);
      setMyRequest(ym, request);
      setLineErrors({});
      setNotice(null);
      showToast(t('request.toast.saved', { month }));
    } catch (e) {
      const failure = saveFailure(e, cart.lines, (k, o) => t(k, { contact, ...o }), ym);
      if (failure.kind === 'locked') {
        setLineErrors({});
        setNotice(lockedNotice(t, ym, failure.nextYm));
        opts.onLocked(failure.nextYm, carryOf(cart.lines));
      } else if (failure.kind === 'stale') {
        setNotice(null);
        setStale(true);
      } else if (failure.kind === 'lines') {
        setLineErrors(failure.byKey);
        const [key, message] = Object.entries(failure.byKey)[0];
        const line = cart.lines.find((l) => l.key === key);
        fail(t('request.errors.notice', { name: line?.label.name ?? '', message }), key);
      } else {
        fail(failure.message);
      }
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  };

  const reload = async () => {
    setReloading(true);
    try {
      const fresh = await refetch();
      if (fresh !== undefined) cart.markSaved(fresh);
      setLineErrors({});
      setNotice(null);
      setStale(false);
    } catch {
      setStale(false);
      fail(t('common.loadError'));
    } finally {
      setReloading(false);
    }
  };

  // Sửa dòng nào thì xóa lỗi của dòng đó; lỗi chung ẩn khi người dùng sửa tiếp
  const touched = (key: string) => {
    setNotice(null);
    setLineErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  return {
    confirming,
    openConfirm: () => setConfirming(true),
    closeConfirm: () => setConfirming(false),
    saving,
    save,
    stale,
    closeStale: () => {
      setStale(false);
      fail(t('request.stale.kept'));
    },
    reloading,
    reload,
    lineErrors,
    notice: notice?.text ?? null,
    noticeRef,
    noticeTone: notice?.tone ?? 'danger',
    closeNotice: () => setNotice(null),
    toast,
    showToast,
    showError: (text: string) => fail(text),
    touched,
    clearErrors: () => {
      setLineErrors({});
      setNotice(null);
    },
  };
}
export type SaveFlow = ReturnType<typeof useSaveFlow>;
