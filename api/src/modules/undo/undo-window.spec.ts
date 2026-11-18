import { UNDO_WINDOW_MS, undoRejection } from './undo-window';
import type { UndoRow } from './undo-window';

const T0 = new Date('2026-12-11T03:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);
const row = (over: Partial<UndoRow> = {}): UndoRow => ({
  id: 'u1',
  kind: 'delivery',
  actor_sub: 'admin-1',
  created_at: T0,
  undone_at: null,
  payload: null,
  ...over,
});
const ask = { ids: ['u1'], kind: 'delivery' as const, actor: 'admin-1' };

describe('undoRejection — cửa sổ hoàn tác 5 giây', () => {
  it('cửa sổ là 5 000 ms', () => {
    expect(UNDO_WINDOW_MS).toBe(5000);
  });

  it('hoàn tác ở 4 999 ms → được (null)', () => {
    expect(undoRejection([row()], { ...ask, now: at(4999) })).toBeNull();
  });

  it('hoàn tác ở 5 000 ms → UNDO_EXPIRED', () => {
    expect(undoRejection([row()], { ...ask, now: at(5000) })).toBe(
      'UNDO_EXPIRED',
    );
  });

  it('đã hoàn tác rồi → UNDO_ALREADY_DONE, kể cả khi đã quá 5 000 ms', () => {
    const done = row({ undone_at: at(1000) });
    expect(undoRejection([done], { ...ask, now: at(2000) })).toBe(
      'UNDO_ALREADY_DONE',
    );
    expect(undoRejection([done], { ...ask, now: at(9000) })).toBe(
      'UNDO_ALREADY_DONE',
    );
  });

  it('id không có, khác loại, hay của người khác → UNDO_NOT_FOUND', () => {
    const now = at(10);
    expect(undoRejection([], { ...ask, now })).toBe('UNDO_NOT_FOUND');
    expect(undoRejection([row({ kind: 'cancel' })], { ...ask, now })).toBe(
      'UNDO_NOT_FOUND',
    );
    expect(
      undoRejection([row({ actor_sub: 'admin-2' })], { ...ask, now }),
    ).toBe('UNDO_NOT_FOUND');
  });

  it('nhiều id: một id thiếu → UNDO_NOT_FOUND; một id quá hạn → UNDO_EXPIRED cả lô', () => {
    const two = { ...ask, ids: ['u1', 'u2'] };
    expect(undoRejection([row()], { ...two, now: at(10) })).toBe(
      'UNDO_NOT_FOUND',
    );
    const old = row({ id: 'u2', created_at: at(-1) });
    expect(undoRejection([row(), old], { ...two, now: at(4999) })).toBe(
      'UNDO_EXPIRED',
    );
    expect(
      undoRejection([row(), row({ id: 'u2' })], { ...two, now: at(4999) }),
    ).toBeNull();
  });
});
