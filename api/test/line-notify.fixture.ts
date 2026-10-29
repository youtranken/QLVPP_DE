import { reviewFixture } from './review.fixture';

export function lineNotifyFixture(tag: string) {
  const f = reviewFixture(tag);
  const { SUFFIX, pool } = f;
  const ADMIN2 = `e2e-req-admin2-${SUFFIX}`;
  const LOCKED_ADMIN = `e2e-req-admin-locked-${SUFFIX}`;
  const TRIGGER = `line_notify_fail_${process.pid}_${tag.replace(/\W/g, '_')}`;

  beforeAll(async () => {
    await pool().query(
      `UPDATE users SET groups = '["VPP-Admin"]'::jsonb WHERE sub = $1`,
      [f.ADMIN],
    );
    await pool().query(
      `INSERT INTO users (sub, full_name, department, status, groups) VALUES
         ($1, 'Hành chính 2', 'Phòng HC', 'active', '["vpp-admin"]'::jsonb),
         ($2, 'Hành chính nghỉ', 'Phòng HC', 'locked', '["vpp-admin"]'::jsonb)`,
      [ADMIN2, LOCKED_ADMIN],
    );
  });

  const bells = async (topic: string, sub: string) =>
    (
      await pool().query<{
        event_id: string;
        params: Record<string, unknown>;
        link: string | null;
      }>(
        `SELECT event_id, params, link FROM in_app_notifications
         WHERE user_sub = $1 AND topic = $2 ORDER BY created_at, event_id`,
        [sub, topic],
      )
    ).rows;

  const breakNotifications = async () => {
    await pool().query(`CREATE FUNCTION ${TRIGGER}() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'boom' USING ERRCODE = 'P0001'; END $$`);
    await pool()
      .query(`CREATE TRIGGER ${TRIGGER} BEFORE INSERT ON in_app_notifications
      FOR EACH ROW EXECUTE FUNCTION ${TRIGGER}()`);
  };
  const repairNotifications = async () => {
    await pool().query(
      `DROP TRIGGER IF EXISTS ${TRIGGER} ON in_app_notifications`,
    );
    await pool().query(`DROP FUNCTION IF EXISTS ${TRIGGER}()`);
  };

  f.onCleanup(async (p) => {
    await p.query('DELETE FROM in_app_notifications WHERE user_sub LIKE $1', [
      `e2e-req-%-${SUFFIX}`,
    ]);
  });

  return {
    ...f,
    ADMIN2,
    LOCKED_ADMIN,
    bells,
    breakNotifications,
    repairNotifications,
  };
}
