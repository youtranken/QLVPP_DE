import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useConfirm, type ConfirmOptions } from '@/ui/confirm-context';

// App dùng <BrowserRouter> (không phải data router) nên không có useBlocker:
// chặn click link nội bộ ở pha capture, trước handler của <Link>, rồi tự điều hướng khi người dùng đồng ý
export function useLeaveGuard(dirtyCount: number, prompt?: ConfirmOptions) {
  const { t } = useTranslation();
  const ask = useConfirm();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const active = dirtyCount > 0;

  useEffect(() => {
    if (!active) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (!(a instanceof HTMLAnchorElement) || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      // Link ra ngoài để beforeunload lo; link trong cùng trang (vd #main) không rời trang
      if (url.origin !== window.location.origin || url.pathname + url.search === pathname + search) return;
      e.preventDefault();
      e.stopPropagation();
      void ask(
        prompt ?? {
          title: t('request.leave.title'),
          message: t('request.leave.body', { n: dirtyCount }),
          confirmLabel: t('request.leave.leave'),
          cancelLabel: t('request.leave.stay'),
          danger: true,
        },
      ).then((ok) => {
        if (ok) navigate(url.pathname + url.search + url.hash);
      });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [active, dirtyCount, prompt, pathname, search, ask, navigate, t]);
}
