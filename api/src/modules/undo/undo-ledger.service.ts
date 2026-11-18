import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Executor, Tx } from '../../database/database.module';
import { undoError } from './undo-errors';
import { undoRejection } from './undo-window';
import type { UndoAsk, UndoKind, UndoRow } from './undo-window';

export interface UndoRecord {
  id: string;
  kind: UndoKind;
  actor: string;
  now: Date;
  payload?: Record<string, unknown> | null;
}

// Sổ hoàn tác dùng chung; module chủ thao tác tự đảo dữ liệu của mình sau khi claimWithin thành công
@Injectable()
export class UndoLedgerService {
  async record(ex: Executor, r: UndoRecord): Promise<string> {
    await ex.execute(sql`
      INSERT INTO undo_actions (id, kind, actor_sub, created_at, payload)
      VALUES (${r.id}, ${r.kind}, ${r.actor}, ${r.now.toISOString()}::timestamptz,
              ${r.payload ? JSON.stringify(r.payload) : null}::jsonb)
    `);
    return r.id;
  }

  // Khóa sổ trước mọi bảng nghiệp vụ (undo_actions → requests → request_lines → items); bên song song chờ rồi thấy đã làm
  async claimWithin(tx: Tx, ask: UndoAsk): Promise<UndoRow[]> {
    const { rows } = await tx.execute<UndoRow & Record<string, unknown>>(sql`
      SELECT id, kind, actor_sub, created_at, undone_at, payload FROM undo_actions
      WHERE id = ANY(${sql.param(ask.ids)}::uuid[])
      ORDER BY id FOR UPDATE
    `);
    const parsed = rows.map(toRow);
    const code = undoRejection(parsed, ask);
    if (code) throw undoError(code);
    await tx.execute(sql`
      UPDATE undo_actions SET undone_at = ${ask.now.toISOString()}::timestamptz
      WHERE id = ANY(${sql.param(ask.ids)}::uuid[]) AND undone_at IS NULL
    `);
    return parsed;
  }
}

function toRow(r: UndoRow): UndoRow {
  return {
    ...r,
    created_at: new Date(r.created_at),
    undone_at: r.undone_at === null ? null : new Date(r.undone_at),
  };
}
