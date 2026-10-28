import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { saveMyLines, useSetMyRequest, type RequestView } from './request.api';
import { saveFailure } from './request-errors';
import { monthOf } from './request-format';
import type { Cart } from './use-cart';

const TOAST_MS = 3000;

export function useSaveFlow(cart: Cart, ym: string, refetch: () => Promise<RequestView | null | undefined>) {
  const { t } = useTranslation();
  const me = useMe();
  const setMyRequest = useSetMyRequest();
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stale, setStale] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const month = monthOf(ym);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

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
      setFormError(null);
      showToast(t('request.toast.saved', { month }));
    } catch (e) {
      const failure = saveFailure(e, cart.lines, t, month);
      if (failure.kind === 'stale') setStale(true);
      else if (failure.kind === 'lines') setLineErrors(failure.byKey);
      else setFormError(failure.message);
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
      setFormError(null);
      setStale(false);
    } catch {
      setFormError(t('common.loadError'));
    } finally {
      setReloading(false);
    }
  };

  // Sửa dòng nào thì xóa lỗi của dòng đó; lỗi chung ẩn khi người dùng sửa tiếp
  const touched = (key: string) => {
    setFormError(null);
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
    closeStale: () => setStale(false),
    reloading,
    reload,
    lineErrors,
    formError,
    toast,
    touched,
  };
}
