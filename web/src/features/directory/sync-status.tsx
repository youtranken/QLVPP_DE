import { useTranslation } from 'react-i18next';
import { formatVnStamp } from '@/lib/format-time';
import { useSyncStatus } from './use-sync-status';
import { syncCodeKey } from './sync-errors';

// Chuẩn danh bạ mục 8: giờ VN HH:mm dd/MM; lỗi mới hơn lần thành công thì nói rõ đang hiện bản cũ
export function SyncStatusLine() {
  const { t } = useTranslation();
  const { data, isError } = useSyncStatus();
  if (isError) return null;
  if (data === undefined) return <span className="dr-auto" aria-hidden="true" />;
  const lastAt = data.last_at ?? null;
  const err = data.last_error ?? null;
  const failed = err !== null && (lastAt === null || new Date(err.at).getTime() > new Date(lastAt).getTime());
  let text: string;
  if (failed) {
    const reason = t(syncCodeKey(err.code));
    text = lastAt
      ? t('users.page.syncStatusFailed', { at: formatVnStamp(err.at), prev: formatVnStamp(lastAt), reason })
      : t('users.page.syncStatusFailedFirst', { at: formatVnStamp(err.at), reason });
  } else {
    text = lastAt ? t('users.page.syncStatusOk', { at: formatVnStamp(lastAt) }) : t('users.page.syncStatusNever');
  }
  return (
    <span className="dr-auto dr-auto--status" role="status" data-failed={failed || undefined}>
      {text}
    </span>
  );
}
