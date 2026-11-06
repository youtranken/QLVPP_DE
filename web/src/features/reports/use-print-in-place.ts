import { createElement, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { formatVnStamp } from '@/lib/format-time';
import { useToast } from '@/ui/toast-context';
import type { SnapshotData } from './reports.api';
import { PrintPortal } from './print-portal';
import { insertPageStyle } from './print-page-style';

export const READY_TIMEOUT_MS = 3000;
export const BLOCKED_AFTER_MS = 1000;
export type PrintResult = 'printed' | 'blocked';

// Font + ảnh trong vùng in sẵn sàng, tối đa 3 s: ảnh lỗi/treo không giữ nút mãi
export function waitReady(root: HTMLElement | null): Promise<void> {
  const images = root ? [...root.querySelectorAll('img')] : [];
  const ready = Promise.all([document.fonts?.ready, ...images.map((img) => img.decode().catch(() => undefined))]);
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, READY_TIMEOUT_MS);
    void ready.then(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

// beforeprint bắn ngay trong window.print() (Chrome) hoặc trễ chút; 1 s không có = trình duyệt chặn hộp in
function openDialog(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const opened = () => {
      clearTimeout(timer);
      window.removeEventListener('beforeprint', opened);
      resolve(true);
    };
    const timer = setTimeout(() => {
      window.removeEventListener('beforeprint', opened);
      resolve(false);
    }, BLOCKED_AFTER_MS);
    window.addEventListener('beforeprint', opened);
    try {
      window.print();
    } catch (e) {
      clearTimeout(timer);
      window.removeEventListener('beforeprint', opened);
      reject(e);
    }
  });
}

// Gỡ vùng in + @page: afterprint, hoặc trang lấy lại focus (iOS/Firefox không chắc có afterprint), hoặc rời trang, hoặc trước lần in kế
function useRegion() {
  const [snap, setSnap] = useState<SnapshotData | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const clear = useRef<() => void>(() => {});
  useEffect(() => () => clear.current(), []);
  const mount = (data: SnapshotData, onPrinted: () => void) => {
    clear.current();
    flushSync(() => setSnap(data));
    let style: HTMLStyleElement | null = null;
    const done = (printed: boolean) => {
      window.removeEventListener('afterprint', after);
      window.removeEventListener('focus', after);
      style?.remove();
      clear.current = () => {};
      setSnap(null);
      if (printed) onPrinted();
    };
    const after = () => done(true);
    clear.current = () => done(false);
    return {
      arm: () => {
        style = insertPageStyle();
        window.addEventListener('afterprint', after);
        window.addEventListener('focus', after);
      },
      drop: () => done(false),
    };
  };
  return { snap, ref, mount };
}

export function usePrintInPlace() {
  const { t } = useTranslation();
  const toast = useToast();
  const region = useRegion();
  const [pending, setPending] = useState(false);
  const reprint = () => {
    if (region.ref.current) window.print();
  };

  const print = async (data: SnapshotData): Promise<PrintResult> => {
    const time = formatVnStamp(data.created_at);
    const shown = region.mount(data, () => toast.show({ text: t('reports.page.printedToast', { time }), tone: 'ok' }));
    setPending(true);
    try {
      await waitReady(region.ref.current);
      shown.arm();
      if (await openDialog()) return 'printed';
      toast.show({ text: t('reports.page.printBlocked'), tone: 'warn', action: { label: t('reports.print.toolbar.print'), onClick: reprint } });
      return 'blocked';
    } catch {
      shown.drop();
      toast.show({ text: t('reports.page.printFailed', { time }), tone: 'danger' });
      return 'blocked';
    } finally {
      setPending(false);
    }
  };

  return { print, pending, portal: createElement(PrintPortal, { snap: region.snap, ref: region.ref }) };
}
