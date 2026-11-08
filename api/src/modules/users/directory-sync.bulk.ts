import { inArray, sql } from 'drizzle-orm';
import type { Database } from '../../database/database.module';
import type { DirectoryUser } from './directory.client';
import {
  directoryLabel,
  inactiveAtFor,
  toAppRole,
} from './user-access.service';
import { usersTable } from './users.schema';

// Phần ghi hàng loạt của một lượt đồng bộ (chạy trong transaction của DirectorySyncService)
const SELECT_CHUNK = 5_000;
const INSERT_CHUNK = 500;

interface ExistingRow {
  sub: string;
  email: string | null;
  employeeCode: string | null;
  fullName: string | null;
  department: string | null;
  team: string | null;
  status: string;
  role: string;
}

// Giá trị sẽ ghi; undefined = nguồn không nói gì → giữ giá trị cũ
interface Target {
  email: string | null | undefined;
  employeeCode: string | null | undefined;
  fullName: string | null | undefined;
  department: string | null | undefined;
  team: string | null | undefined;
  role: string;
  status: string;
}

export interface BulkOutcome {
  created: number;
  updated: number;
  unchanged: number;
  deleted: string[];
  reappeared: string[];
  roleChanges: { sub: string; from: string; to: string }[];
}

export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

// Khóa theo thứ tự sub: markNoAccess/webhook đồng thời phải chờ, 2 sync song song không deadlock
export async function loadExisting(
  tx: Tx,
  users: DirectoryUser[],
): Promise<Map<string, ExistingRow>> {
  const existing = new Map<string, ExistingRow>();
  const ids = users.map((u) => u.id);
  for (let i = 0; i < ids.length; i += SELECT_CHUNK) {
    const rows = await tx
      .select({
        sub: usersTable.sub,
        email: usersTable.email,
        employeeCode: usersTable.employeeCode,
        fullName: usersTable.fullName,
        department: usersTable.department,
        team: usersTable.team,
        status: usersTable.status,
        role: usersTable.role,
      })
      .from(usersTable)
      .where(inArray(usersTable.sub, ids.slice(i, i + SELECT_CHUNK)))
      .orderBy(usersTable.sub)
      .for('update');
    for (const r of rows) existing.set(r.sub, r);
  }
  return existing;
}

export function classify(
  users: DirectoryUser[],
  existing: Map<string, ExistingRow>,
): {
  out: BulkOutcome;
  toInsert: DirectoryUser[];
  toUpdate: { sub: string; target: Target }[];
} {
  const out: BulkOutcome = {
    created: 0,
    updated: 0,
    unchanged: 0,
    deleted: [],
    reappeared: [],
    roleChanges: [],
  };
  const toInsert: DirectoryUser[] = [];
  const toUpdate: { sub: string; target: Target }[] = [];
  for (const user of users) {
    const current = existing.get(user.id);
    if (user.status === 'deleted' && current?.status !== 'deleted') {
      out.deleted.push(user.id);
    }
    if (!current) {
      toInsert.push(user);
      continue;
    }
    const target = targetFor(user, current);
    if (current.status === 'no_access' && user.status === 'active') {
      out.reappeared.push(user.id);
    }
    if (target.role !== current.role) {
      out.roleChanges.push({
        sub: user.id,
        from: current.role,
        to: target.role,
      });
    }
    if (differs(current, target)) toUpdate.push({ sub: user.id, target });
    else out.unchanged += 1;
  }
  return { out, toInsert, toUpdate };
}

function targetFor(user: DirectoryUser, current: ExistingRow): Target {
  const keepNoAccess =
    current.status === 'no_access' && user.status === 'active';
  return {
    email: user.email,
    employeeCode: user.employee_code,
    fullName: user.full_name,
    department: directoryLabel(user.department),
    team: directoryLabel(user.team),
    role: toAppRole(user.app_role),
    status: keepNoAccess ? 'no_access' : user.status,
  };
}

function differs(current: ExistingRow, t: Target): boolean {
  const changed = <T>(next: T | null | undefined, cur: T | null) =>
    next !== undefined && (next ?? null) !== cur;
  return (
    changed(t.email, current.email) ||
    changed(t.employeeCode, current.employeeCode) ||
    changed(t.fullName, current.fullName) ||
    changed(t.department, current.department) ||
    changed(t.team, current.team) ||
    t.role !== current.role ||
    t.status !== current.status
  );
}

export async function insertNew(
  tx: Tx,
  users: DirectoryUser[],
): Promise<number> {
  for (let i = 0; i < users.length; i += INSERT_CHUNK) {
    await tx
      .insert(usersTable)
      .values(
        users.slice(i, i + INSERT_CHUNK).map((u) => ({
          sub: u.id,
          email: u.email ?? null,
          employeeCode: u.employee_code ?? null,
          fullName: u.full_name ?? null,
          department: directoryLabel(u.department) ?? null,
          team: directoryLabel(u.team) ?? null,
          role: toAppRole(u.app_role),
          status: u.status,
          inactiveAt: u.status === 'active' ? null : sql`clock_timestamp()`,
        })),
      )
      .onConflictDoUpdate({
        target: usersTable.sub,
        set: {
          email: sql`excluded.email`,
          employeeCode: sql`excluded.employee_code`,
          fullName: sql`excluded.full_name`,
          department: sql`excluded.department`,
          team: sql`excluded.team`,
          role: sql`excluded.role`,
          // Hàng vừa bị thu hồi xen giữa (insert đua) → giữ no_access
          status: sql`CASE WHEN ${usersTable.status} = 'no_access' THEN ${usersTable.status} ELSE excluded.status END`,
          inactiveAt: sql`CASE WHEN ${usersTable.status} = 'no_access' THEN ${usersTable.inactiveAt} ELSE excluded.inactive_at END`,
          updatedAt: sql`now()`,
        },
      });
  }
  return users.length;
}

export async function updateChanged(
  tx: Tx,
  rows: { sub: string; target: Target }[],
): Promise<number> {
  const now = new Date();
  for (const { sub, target: t } of rows) {
    await tx
      .update(usersTable)
      .set({
        ...(t.email !== undefined ? { email: t.email ?? null } : {}),
        ...(t.employeeCode !== undefined
          ? { employeeCode: t.employeeCode ?? null }
          : {}),
        ...(t.fullName !== undefined ? { fullName: t.fullName ?? null } : {}),
        ...(t.department !== undefined ? { department: t.department } : {}),
        ...(t.team !== undefined ? { team: t.team } : {}),
        role: t.role,
        status: t.status,
        inactiveAt: inactiveAtFor(t.status),
        updatedAt: now,
      })
      .where(inArray(usersTable.sub, [sub]));
  }
  return rows.length;
}
