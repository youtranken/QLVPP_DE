import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isForbiddenRole } from '@/lib/api-error';

// Vai được tính mỗi request: bị gỡ nhóm Hành chính thì mọi API admin trả FORBIDDEN_ROLE → cả trang thành NoPermission
export function useForbiddenRole(): boolean {
  const qc = useQueryClient();
  const [forbidden, setForbidden] = useState(() => qc.getQueryCache().getAll().some((q) => isForbiddenRole(q.state.error)));
  useEffect(() => {
    const onError = (e: unknown) => {
      if (isForbiddenRole(e)) setForbidden(true);
    };
    const offQueries = qc.getQueryCache().subscribe((ev) => {
      if (ev.type === 'updated' && ev.action.type === 'error') onError(ev.action.error);
    });
    const offMutations = qc.getMutationCache().subscribe((ev) => {
      if (ev.type === 'updated' && ev.action.type === 'error') onError(ev.action.error);
    });
    return () => {
      offQueries();
      offMutations();
    };
  }, [qc]);
  return forbidden;
}
