import {
  DEFAULT_REGISTRATION_WINDOW,
  formatRequestCode,
  periodForDate,
  type RegistrationWindow,
} from '@vpp/shared';
import { count } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { mapGroups } from '../../auth/group-mapping';
import { parseToolEnv } from '../config/env';
import { loadRootEnv } from '../config/load-env';
import { DEMO_REQUESTS, DEMO_USERS, type DemoLine } from './demo-data';
import * as schema from './schema';
import { appSettings, departments, items, requestItems, requests, users } from './schema';

/**
 * Nạp dữ liệu DEMO: người dùng + đơn mẫu nhiều kỳ, nhiều trạng thái (SDD §11).
 * Chạy SAU `db:seed` vì cần danh mục đã có.
 *
 * **Chạy lại được**: nếu đã có đơn nào trong CSDL thì bỏ qua, để không nhân đôi
 * dữ liệu mỗi lần khởi động lại stack.
 */

/** Lùi `offset` tháng so với kỳ hiện tại, trả về 'YYYY-MM'. */
function periodBefore(offset: number, window: RegistrationWindow): string {
  const [year, month] = periodForDate(window).split('-').map(Number);
  const date = new Date(year, month - 1 - offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

async function main(): Promise<void> {
  loadRootEnv();
  const config = parseToolEnv();
  const pool = new Pool({ connectionString: config.DATABASE_URL });
  const db = drizzle(pool, { schema, casing: 'snake_case' });

  try {
    const [{ value: existingRequests }] = await db.select({ value: count() }).from(requests);
    if (existingRequests > 0) {
      console.log(`Đã có ${existingRequests} đơn trong CSDL — bỏ qua seed demo.`);
      return;
    }

    // ── Người dùng ────────────────────────────────────────────────────────
    // `source='directory'`: những người này chưa từng đăng nhập, đúng như khi
    // danh bạ được kéo về từ PMH ID. Đăng nhập thật sẽ tự đổi thành 'login'.
    const userIdBySub = new Map<string, string>();
    for (const demoUser of DEMO_USERS) {
      const identity = mapGroups(demoUser.groups, {
        adminGroup: config.VPP_ADMIN_GROUP,
        departmentGroups: config.VPP_DEPARTMENT_GROUPS,
      });
      const values = {
        pmhSub: demoUser.pmhSub,
        email: demoUser.email,
        name: demoUser.name,
        employeeCode: demoUser.employeeCode,
        groups: demoUser.groups,
        department: identity.department,
        role: identity.role,
        source: 'directory' as const,
      };
      const [row] = await db
        .insert(users)
        .values(values)
        .onConflictDoUpdate({ target: users.pmhSub, set: values })
        .returning({ id: users.id });
      userIdBySub.set(demoUser.pmhSub, row.id);

      if (identity.department) {
        await db.insert(departments).values({ name: identity.department }).onConflictDoNothing();
      }
    }

    // ── Tra cứu danh mục & phòng ban ──────────────────────────────────────
    const catalogItems = await db.select().from(items);
    const itemByName = new Map(catalogItems.map((item) => [item.name, item]));
    const departmentRows = await db.select().from(departments);
    const departmentIdByName = new Map(departmentRows.map((row) => [row.name, row.id]));
    const userRows = await db.select().from(users);
    const userBySub = new Map(userRows.map((row) => [row.pmhSub, row]));

    /** Khớp tên món trong dữ liệu demo với danh mục; dòng "Khác" thì tự nhập. */
    const resolveLine = (line: DemoLine) => {
      if (line.custom) {
        return {
          itemId: null,
          name: line.item,
          unit: line.unit ?? 'cái',
          quantity: line.quantity,
        };
      }
      const item = itemByName.get(line.item);
      if (!item) throw new Error(`Dữ liệu demo trỏ tới món không có trong danh mục: ${line.item}`);
      return { itemId: item.id, name: item.name, unit: item.unit, quantity: line.quantity };
    };

    // ── Đơn mẫu ───────────────────────────────────────────────────────────
    // Kỳ của đơn demo phụ thuộc khung ngày admin đang đặt, nên phải đọc từ CSDL.
    // Chưa có dòng cài đặt (CSDL mới) thì dùng mặc định.
    const [windowRow] = await db
      .select({ startDay: appSettings.regWindowStartDay, endDay: appSettings.regWindowEndDay })
      .from(appSettings)
      .limit(1);
    const window: RegistrationWindow = windowRow ?? DEFAULT_REGISTRATION_WINDOW;

    const sequenceByPeriod = new Map<string, number>();
    let created = 0;

    for (const demo of DEMO_REQUESTS) {
      const user = userBySub.get(demo.user);
      if (!user) throw new Error(`Dữ liệu demo trỏ tới user không tồn tại: ${demo.user}`);

      const period = periodBefore(demo.periodOffset, window);
      const sequence = (sequenceByPeriod.get(period) ?? 0) + 1;
      sequenceByPeriod.set(period, sequence);

      const lines = demo.lines.map(resolveLine);
      const deliveredCount =
        demo.status === 'delivered' ? lines.length : (demo.deliveredLines ?? 0);

      const [request] = await db
        .insert(requests)
        .values({
          code: formatRequestCode(period, sequence),
          userId: user.id,
          departmentId: user.department ? (departmentIdByName.get(user.department) ?? null) : null,
          period,
          status: demo.status,
          note: demo.note ?? null,
          rejectReason: demo.rejectReason ?? null,
          approvedBy: demo.status === 'submitted' ? null : (userIdBySub.get('usr_admin') ?? null),
          approvedAt: ['approved', 'delivered'].includes(demo.status) ? new Date() : null,
          deliveredAt: demo.status === 'delivered' ? new Date() : null,
        })
        .returning({ id: requests.id });

      await db.insert(requestItems).values(
        lines.map((line, index) => ({
          ...line,
          requestId: request.id,
          delivered: index < deliveredCount,
          deliveredQty: index < deliveredCount ? line.quantity : 0,
        })),
      );
      created += 1;
    }

    const [{ value: userCount }] = await db.select({ value: count() }).from(users);
    console.log(`Seed demo xong: ${userCount} người dùng, ${created} đơn mẫu.`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Seed demo thất bại:', error);
  process.exit(1);
});
