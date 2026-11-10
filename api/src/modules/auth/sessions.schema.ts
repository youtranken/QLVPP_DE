import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const sessionsTable = pgTable('sessions', {
  id: uuid('id').primaryKey(),
  userSub: text('user_sub').notNull(),
  refreshToken: text('refresh_token'),
  // access token PMH ID mới nhất — gọi PUT /api/me/locale thay người dùng (docs 7a)
  accessToken: text('access_token'),
  accessTokenExp: timestamp('access_token_exp', { withTimezone: true }),
  claims: jsonb('claims'),
  // id_token lúc login — làm id_token_hint khi switch-account
  idToken: text('id_token'),
  csrfToken: text('csrf_token').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
