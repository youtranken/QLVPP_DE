import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { useFormatTime } from '@/lib/format-time';
import type { AuditEntry } from '@/features/admin/admin.api';

type Translate = (key: string, opts?: Record<string, unknown>) => string;

// Sửa dữ liệu ghi {before, after}; sự kiện khác (đăng nhập, đồng bộ…) chỉ có detail tự do
function detailLines(detail: unknown, t: Translate): string[] {
  if (detail === null || typeof detail !== 'object') return [];
  const d = detail as Record<string, unknown>;
  if (!('before' in d) && !('after' in d)) return Object.keys(d).length > 0 ? [JSON.stringify(d)] : [];
  const lines: string[] = [];
  if ('before' in d) lines.push(t('audit.page.before', { json: JSON.stringify(d.before) }));
  if ('after' in d) lines.push(t('audit.page.after', { json: JSON.stringify(d.after) }));
  return lines;
}

export function useAuditColumns(): ColumnDef<AuditEntry, unknown>[] {
  const { t } = useTranslation();
  const formatTime = useFormatTime();
  return useMemo(
    () => [
      {
        id: 'time',
        header: t('audit.page.colTime'),
        enableSorting: false,
        meta: { className: 'nowrap' },
        cell: ({ row }) => formatTime(row.original.createdAt),
      },
      {
        id: 'actor',
        header: t('audit.page.colActor'),
        enableSorting: false,
        cell: ({ row }) => row.original.actorName ?? <code className="audit-code">{row.original.actor}</code>,
      },
      {
        id: 'action',
        header: t('audit.page.colAction'),
        enableSorting: false,
        cell: ({ row }) => <code className="audit-code">{row.original.action}</code>,
      },
      {
        id: 'object',
        header: t('audit.page.colObject'),
        enableSorting: false,
        cell: ({ row }) =>
          [row.original.objectType, row.original.objectId].filter(Boolean).join(' · ') || t('common.empty'),
      },
      {
        id: 'detail',
        header: t('audit.page.colDetail'),
        enableSorting: false,
        meta: { className: 'audit-detail' },
        cell: ({ row }) => (
          <div className="audit-json">
            {detailLines(row.original.detail, t).map((line) => (
              <code key={line}>{line}</code>
            ))}
          </div>
        ),
      },
    ],
    [t, formatTime],
  );
}
