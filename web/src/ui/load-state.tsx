import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EmptyArt } from '@/ui/empty-art';
import type { EmptyArtKind } from '@/ui/empty-art';
import { IconAlert, IconLock, IconSearch } from '@/ui/icons';

// Mọi màn fetch phải phân biệt "đang tải" ≠ "rỗng" ≠ "lỗi" — không nuốt lỗi thành rỗng

export function EmptyState({
  title,
  hint,
  action,
  art,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  art?: EmptyArtKind;
}) {
  return (
    <div className="empty">
      {art && <EmptyArt kind={art} />}
      <span className="empty-title">{title}</span>
      {hint && <span className="empty-hint">{hint}</span>}
      {action && <span className="empty-action">{action}</span>}
    </div>
  );
}

// inPage: tiêu đề đã nằm ở đầu khung trang (MemberPage), thân chỉ còn hình, gợi ý và nút — không lặp h1
export function NotFound({ inPage = false }: { inPage?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="state-page">
      <span className="state-ic">
        <IconSearch />
      </span>
      {!inPage && <h1>{t('common.notFoundTitle')}</h1>}
      <p>{t('common.notFoundHint')}</p>
      <Link className="btn btn--primary" to="/">
        {t('common.backHome')}
      </Link>
    </div>
  );
}

export function NoPermission() {
  const { t } = useTranslation();
  return (
    <div className="state-page" role="alert">
      <span className="state-ic is-warn">
        <IconLock />
      </span>
      <h1>{t('common.noPermission')}</h1>
      <Link className="btn btn--primary" to="/">
        {t('common.backHome')}
      </Link>
    </div>
  );
}

export function ChunkError() {
  const { t } = useTranslation();
  return (
    <div className="state-page" role="alert">
      <span className="state-ic is-danger">
        <IconAlert />
      </span>
      <p>{t('common.chunkError')}</p>
      <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
        {t('common.reload')}
      </button>
    </div>
  );
}

export function Loading({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <div className="load-state" role="status" aria-busy="true">
      <span className="spinner" aria-hidden="true" />
      <span>{label ?? t('common.loading')}</span>
    </div>
  );
}

export function LoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="load-error" role="alert">
      <IconAlert />
      <p>{t('common.loadError')}</p>
      <button type="button" className="btn btn--sm" onClick={onRetry}>
        {t('common.retry')}
      </button>
    </div>
  );
}
