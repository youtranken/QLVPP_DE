import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const usersTable = pgTable('users', {
  sub: text('sub').primaryKey(),
  email: text('email'),
  employeeCode: text('employee_code'),
  fullName: text('full_name'),
  department: text('department'),
  team: text('team'),
  status: text('status').notNull().default('active'),
  role: text('role').notNull().default('member'),
  firstLoginAt: timestamp('first_login_at', { withTimezone: true }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  inactiveAt: timestamp('inactive_at', { withTimezone: true }),
  accessCheckedAt: timestamp('access_checked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
