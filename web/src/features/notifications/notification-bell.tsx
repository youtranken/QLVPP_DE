import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFormatTime } from '@/lib/format-time';
import { useUnitNames } from '@/features/units/units.api';
import { IconBell } from '@/ui/icons';
import { Loading, LoadError } from '@/ui/load-state';
import { notificationText } from './notification-text';
import { useMarkRead, useNotifications, useUnreadCount } from './notifications.api';
import type { NotificationView } from './notifications.api';

const BADGE_CAP = 9;

// Chỉ đường dẫn nội bộ: `//host` và `/\host` trình duyệt hiểu là máy khác
const isInternalLink = (link: string | null): link is string =>
  link !== null && link.startsWith('/') && !link.startsWith('//') && !link.startsWith('/\\');

function useDismiss(open: boolean, close: () => void, box: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onDown = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && close();
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, close, box]);
}

function NotificationRow({ n, onPick }: { n: NotificationView; onPick: (n: NotificationView) => void }) {
  const { t, i18n } = useTranslation();
  const formatTime = useFormatTime();
  const unitName = useUnitNames();
  return (
    <li className={n.read_at ? 'notif-item' : 'notif-item is-unread'}>
      <button type="button" onClick={() => onPick(n)}>
        {!n.read_at && <span className="sr-only">{t('notifications.unreadMark')}. </span>}
        <span className="notif-text">{notificationText(n, t, i18n.language, unitName)}</span>
        <time className="notif-time" dateTime={n.created_at}>
          {formatTime(n.created_at)}
        </time>
      </button>
    </li>
  );
}

export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const unread = useUnreadCount();
  const list = useNotifications(open);
  const mark = useMarkRead();
  const [markFailed, setMarkFailed] = useState(false);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  useDismiss(open, close, box);

  const markAll = () => {
    setMarkFailed(false);
    mark.mutate(undefined, { onError: () => setMarkFailed(true) });
  };

  // Đánh dấu lỗi thì ở lại bảng với câu lỗi (bấm lại để thử), không để bảng mở đè lên trang mới
  const pick = async (n: NotificationView) => {
    setMarkFailed(false);
    if (!n.read_at) {
      const ok = await mark.mutateAsync([n.id]).then(() => true, () => false);
      if (!ok) return setMarkFailed(true);
    }
    setOpen(false);
    if (isInternalLink(n.link)) navigate(n.link);
  };

  return (
    <div className="notif" ref={box}>
      <button
        ref={button}
        type="button"
        className="notif-btn"
        aria-label={t('notifications.bell', { count: unread })}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <IconBell />
        {unread > 0 && (
          <span className="notif-badge" aria-hidden="true">
            {unread > BADGE_CAP ? `${BADGE_CAP}+` : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="notif-panel" role="dialog" aria-label={t('notifications.title')}>
          <div className="notif-head">
            <strong>{t('notifications.title')}</strong>
            {unread > 0 && (
              <button type="button" className="notif-all" onClick={() => markAll()}>
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>
          {markFailed && (
            <p className="notif-empty" role="alert">
              {t('notifications.markError')}
            </p>
          )}
          {/* Cùng kiểu trạng thái tải/lỗi với các trang: đang tải (cả lúc react-query thử lại) có spinner, lỗi có nút Thử lại */}
          {list.isPending && !list.isError && <Loading />}
          {list.isError && (
            <div className="notif-state">
              <LoadError message={t('notifications.loadError')} onRetry={() => void list.refetch()} />
            </div>
          )}
          {!list.isError && list.isSuccess && items.length === 0 && <p className="notif-empty">{t('notifications.empty')}</p>}
          {items.length > 0 && (
            <ul className="notif-list">
              {items.map((n) => (
                <NotificationRow key={n.id} n={n} onPick={pick} />
              ))}
            </ul>
          )}
          {list.hasNextPage && (
            <button type="button" className="notif-more" disabled={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
              {t('notifications.loadMore')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
