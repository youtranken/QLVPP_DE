import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { parseEnv } from '../config/env';
import * as schema from './schema';

/** Token DI để inject instance Drizzle: `@Inject(DB) private readonly db: Db`. */
export const DB = Symbol('DRIZZLE_DB');
export const PG_POOL = Symbol('PG_POOL');

export type Db = ReturnType<typeof createDb>;

function createDb(pool: Pool) {
  return drizzle(pool, { schema, casing: 'snake_case' });
}

/**
 * Kết nối PostgreSQL dùng chung toàn app (1 pool duy nhất).
 * `@Global` để các feature module không phải import lại.
 */
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (): Pool => new Pool({ connectionString: parseEnv().DATABASE_URL }),
    },
    {
      provide: DB,
      inject: [PG_POOL],
      useFactory: (pool: Pool) => createDb(pool),
    },
  ],
  exports: [DB, PG_POOL],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Đóng pool khi app tắt để tiến trình thoát sạch (test, docker stop). */
  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
