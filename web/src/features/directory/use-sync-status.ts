import { useQuery } from '@tanstack/react-query';
import { fetchSyncStatus } from './directory.api';

export const SYNC_STATUS_KEY = ['directory-sync-status'] as const;

export function useSyncStatus() {
  return useQuery({ queryKey: SYNC_STATUS_KEY, queryFn: fetchSyncStatus, staleTime: 60_000 });
}
