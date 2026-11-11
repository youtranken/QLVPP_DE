import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { Executor } from '../../database/database.module';
import { lockPendingLines } from './requests.repo';

const dialect = new PgDialect();

// Ghi lại câu SQL thật: thứ tự khóa requests → request_lines phải là luật của chính câu lệnh
function fakeTx(requestIds: string[]) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const tx = {
    execute: (q: SQL) => {
      const { sql, params } = dialect.sqlToQuery(q);
      queries.push({ sql, params });
      const first = queries.length === 1;
      return Promise.resolve({
        rows: first ? requestIds.map((id) => ({ id })) : [],
      });
    },
  } as unknown as Executor;
  return { tx, queries };
}

describe('lockPendingLines — thứ tự khóa requests → request_lines', () => {
  it('khóa phiếu trước (FOR UPDATE theo id), rồi chỉ khóa dòng chờ của đúng các phiếu vừa khóa', async () => {
    const { tx, queries } = fakeTx(['r-1', 'r-2']);
    await lockPendingLines(tx, '2026-11');
    expect(queries).toHaveLength(2);
    expect(queries[0].sql).toMatch(
      /FROM requests[\s\S]*ORDER BY r\.id FOR UPDATE/,
    );
    expect(queries[1].sql).toMatch(
      /FROM request_lines[\s\S]*ORDER BY id FOR UPDATE/,
    );
    // Không chọn lại phiếu theo kỳ ở câu 2 (phiếu chưa khóa sẽ bị khóa dòng trước phiếu)
    expect(queries[1].sql).not.toMatch(/FROM requests/);
    expect(queries[1].params).toContainEqual(['r-1', 'r-2']);
  });

  it('không phiếu nào có dòng chờ → không chạy câu khóa dòng, trả rỗng', async () => {
    const { tx, queries } = fakeTx([]);
    expect(await lockPendingLines(tx, '2026-11')).toEqual([]);
    expect(queries).toHaveLength(1);
  });
});
