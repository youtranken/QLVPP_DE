import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { NodePgDatabase, drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { createPgPool } from './pg-pool';

export const PG_POOL = 'PG_POOL';
export const DRIZZLE_DB = 'DRIZZLE_DB';

// Bare NodePgDatabase mặc định schema Record<string,never> → lệch kiểu với drizzle(pool) trong db-spec.
export type Database = NodePgDatabase<Record<string, unknown>>;

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (): Pool => createPgPool(process.env.DATABASE_URL),
    },
    {
      provide: DRIZZLE_DB,
      useFactory: (pool: Pool): Database => drizzle(pool),
      inject: [PG_POOL],
    },
  ],
  exports: [PG_POOL, DRIZZLE_DB],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
