export const UNDO_WINDOW_MS = 5000;

export type UndoKind = 'delivery' | 'cancel' | 'item_delete';

export type UndoCode = 'UNDO_NOT_FOUND' | 'UNDO_ALREADY_DONE' | 'UNDO_EXPIRED';

export interface UndoRow {
  id: string;
  kind: UndoKind;
  actor_sub: string;
  created_at: Date;
  undone_at: Date | null;
  payload: Record<string, unknown> | null;
}

export interface UndoAsk {
  ids: string[];
  kind: UndoKind;
  actor: string;
  now: Date;
}

// Thứ tự: không có → đã làm → quá hạn; bấm lần hai sau 5 giây vẫn nói "đã hoàn tác" cho đúng sự thật
export function undoRejection(rows: UndoRow[], ask: UndoAsk): UndoCode | null {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const mine = ask.ids.map((id) => byId.get(id));
  if (
    mine.some((r) => !r || r.kind !== ask.kind || r.actor_sub !== ask.actor)
  ) {
    return 'UNDO_NOT_FOUND';
  }
  const found = mine as UndoRow[];
  if (found.some((r) => r.undone_at !== null)) return 'UNDO_ALREADY_DONE';
  const now = ask.now.getTime();
  if (found.some((r) => now - r.created_at.getTime() >= UNDO_WINDOW_MS)) {
    return 'UNDO_EXPIRED';
  }
  return null;
}
