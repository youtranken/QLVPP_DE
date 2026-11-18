import { apiFetch } from '@/lib/api-client';

export type UndoKind = 'delivery' | 'cancel' | 'item-delete';

// Hoàn tác 5 giây: ids do chính lần thao tác trả về (undo_id); server từ chối sau 5 000 ms
export const undoActions = (kind: UndoKind, ids: string[], csrfToken: string | null) =>
  apiFetch<{ undone: number }>(`/api/admin/undo/${kind}`, { method: 'POST', body: JSON.stringify({ ids }), csrfToken });
