import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type {
  CatalogCategory,
  Me,
  NotificationList,
  RegistrationStatus,
  VppRequest,
} from './types';

/** Khoá query gom một chỗ để không gõ sai chuỗi rải rác khắp nơi. */
export const queryKeys = {
  me: ['me'] as const,
  registrationStatus: ['registration-status'] as const,
  catalog: ['catalog'] as const,
  myRequests: (period?: string) => ['requests', 'mine', period ?? 'all'] as const,
  notifications: ['notifications'] as const,
};

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api.get<Me>('/me'),
    // 401 là "chưa đăng nhập", không phải lỗi tạm thời ⇒ thử lại vô ích.
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRegistrationStatus() {
  return useQuery({
    queryKey: queryKeys.registrationStatus,
    queryFn: () => api.get<RegistrationStatus>('/registration/status'),
  });
}

export function useCatalog() {
  return useQuery({
    queryKey: queryKeys.catalog,
    queryFn: () => api.get<CatalogCategory[]>('/catalog'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMyRequests(period?: string) {
  return useQuery({
    queryKey: queryKeys.myRequests(period),
    queryFn: () => api.get<VppRequest[]>(`/requests/mine${period ? `?period=${period}` : ''}`),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => api.get<NotificationList>('/notifications'),
    // Chuông cần tươi mà không có websocket ⇒ hỏi lại định kỳ.
    refetchInterval: 60_000,
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ updated: number }>('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<void>(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}

export interface CreateRequestLine {
  itemId: string | null;
  name?: string;
  unit?: string;
  quantity: number;
  attachmentPath?: string | null;
  note?: string | null;
}

export function useCreateRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { note?: string | null; lines: CreateRequestLine[] }) =>
      api.post<VppRequest>('/requests', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['requests'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

export function useCancelRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<VppRequest>(`/requests/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['requests'] }),
  });
}
