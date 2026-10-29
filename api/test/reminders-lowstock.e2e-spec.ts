import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { remindersFixture } from './reminders.fixture';

// 12:00 5/11 VN: không phải ngày 1 / nhắc / khóa → chỉ bước sắp hết và dọn có việc
const NOW = '2026-11-05T05:00:00Z';

describe('NotificationScheduler.runHourly — sắp hết báo một lần tới khi nhập mua', () => {
  const f = remindersFixture('low');
  const [A1, A2] = ['admin1', 'admin2'].map(f.sub);
  const items: string[] = [];

  const asAdmin = (path: string, body: object) =>
    f
      .http()
      .post(`/api/admin/items/${path}`)
      .set('x-dev-user-sub', A1)
      .set('x-dev-role', 'admin')
      .send(body)
      .expect(201);
  const newItem = async (name: string) => {
    const { rows } = await f.q<{ id: string }>(
      "INSERT INTO items (name, name_en, unit) VALUES ($1, $2, 'cai') RETURNING id",
      [`${name} ${f.SUFFIX}`, `${name} en`],
    );
    items.push(rows[0].id);
    return rows[0].id;
  };
  const purchase = async (id: string, delta: number) =>
    (await asAdmin(`${id}/stock`, { delta, reason: 'purchase' })).body
      .movement_id as string;
  const issueTo = async (id: string, qty: number) => {
    await asAdmin(`${id}/issue`, { qty, reason: 'Dùng chung phòng' });
  };
  const lowEvents = async (id: string) =>
    (
      await f.q<{ user_sub: string; event_id: string }>(
        `SELECT user_sub, event_id FROM in_app_notifications
         WHERE event_id LIKE $1 AND user_sub = ANY($2) ORDER BY event_id, user_sub`,
        [`low_stock:${id}:%`, [A1, A2]],
      )
    ).rows;
  const notifiedAt = async (id: string) =>
    (
      await f.q<{ at: Date | null }>(
        'SELECT low_stock_notified_at AS at FROM items WHERE id = $1',
        [id],
      )
    ).rows[0].at;

  beforeAll(async () => {
    await f.addUser(A1, [f.adminGroup()]);
    await f.addUser(A2, [f.adminGroup().toUpperCase()]);
  });

  f.onCleanup(async () => {
    await f.q('DELETE FROM stock_movements WHERE item_id = ANY($1)', [items]);
    await f.q('DELETE FROM items WHERE id = ANY($1)', [items]);
  });

  it('nhập 30 (mốc 6): tồn 7 không báo; tồn 6 → low_stock:<id>:<movement nhập> 1 bản ghi mỗi admin; chạy lại không thêm; xuống 5 không thêm', async () => {
    const id = await newItem('Bút bi');
    const buy = await purchase(id, 30);
    await issueTo(id, 23);
    await f.run(NOW);
    expect(await lowEvents(id)).toEqual([]);

    await issueTo(id, 1);
    expect((await f.run(NOW)).low_stock).toBeGreaterThanOrEqual(2);
    const ev = `low_stock:${id}:${buy}`;
    expect(await lowEvents(id)).toEqual([
      { user_sub: A1, event_id: ev },
      { user_sub: A2, event_id: ev },
    ]);
    expect((await f.notes(ev))[0]).toMatchObject({
      topic: 'low_stock',
      params: {
        name: `Bút bi ${f.SUFFIX}`,
        name_en: 'Bút bi en',
        stock_qty: 6,
      },
      link: '/admin/stock?filter=low',
    });
    expect(await notifiedAt(id)).toEqual(new Date(NOW));

    await f.run('2026-11-05T06:00:00Z');
    await issueTo(id, 1);
    await f.run('2026-11-05T07:00:00Z');
    expect(await lowEvents(id)).toHaveLength(2);
  });

  it('nhập 20 lúc tồn 5 (tồn 25, mốc 5) → low_stock_notified_at null; xuất tới 5 → event mới theo movement nhập mới', async () => {
    const id = await newItem('Kẹp giấy');
    const first = await purchase(id, 30);
    await issueTo(id, 25);
    await f.run(NOW);
    expect(await notifiedAt(id)).not.toBeNull();

    const second = await purchase(id, 20);
    expect(await notifiedAt(id)).toBeNull();
    await f.run(NOW);
    expect(await lowEvents(id)).toHaveLength(2);
    await issueTo(id, 19);
    await f.run(NOW);
    expect(await lowEvents(id)).toHaveLength(2);

    await issueTo(id, 1);
    await f.run(NOW);
    expect((await lowEvents(id)).map((e) => e.event_id).sort()).toEqual(
      [first, first, second, second].map((m) => `low_stock:${id}:${m}`).sort(),
    );
  });

  it('nhập 4 (mốc ⌊0,8⌋ = 0) tồn 1 không bao giờ báo (FR-50); tồn 0 là Hết hàng không báo; món ngừng không báo', async () => {
    const tiny = await newItem('Ghim');
    await purchase(tiny, 4);
    await issueTo(tiny, 3);
    const out = await newItem('Mực in');
    await purchase(out, 10);
    await issueTo(out, 10);
    const inactive = await newItem('Bìa cũ');
    await purchase(inactive, 10);
    await issueTo(inactive, 8);
    await f.q('UPDATE items SET active = false WHERE id = $1', [inactive]);

    await f.run(NOW);
    for (const id of [tiny, out, inactive]) {
      expect(await lowEvents(id)).toEqual([]);
      expect(await notifiedAt(id)).toBeNull();
    }
  });

  it('hai runHourly song song (Promise.all) → món chỉ được đòi một lần: notifyWithin gọi đúng 1 lần, mỗi admin 1 bản ghi', async () => {
    const id = await newItem('Băng keo');
    const buy = await purchase(id, 10);
    await issueTo(id, 8);
    const ev = `low_stock:${id}:${buy}`;
    const spy = jest.spyOn(f.app().get(NotificationsService), 'notifyWithin');
    try {
      await Promise.all([f.run(NOW), f.run(NOW)]);
      expect(spy.mock.calls.filter(([, n]) => n.eventId === ev)).toHaveLength(
        1,
      );
    } finally {
      spy.mockRestore();
    }
    expect(await lowEvents(id)).toEqual([
      { user_sub: A1, event_id: ev },
      { user_sub: A2, event_id: ev },
    ]);
  });

  it('low_stock_notify = false → không chuông, món không bị đánh dấu; bật lại true → đúng 1 bản ghi mỗi admin', async () => {
    const id = await newItem('Thước kẻ');
    const buy = await purchase(id, 10);
    await issueTo(id, 8);
    await f.setConfig({ low_stock_notify: false });
    try {
      expect((await f.run(NOW)).low_stock).toBe(0);
      expect(await lowEvents(id)).toEqual([]);
      expect(await notifiedAt(id)).toBeNull();
    } finally {
      await f.setConfig({ low_stock_notify: true });
    }
    await f.run(NOW);
    expect(await lowEvents(id)).toEqual([
      { user_sub: A1, event_id: `low_stock:${id}:${buy}` },
      { user_sub: A2, event_id: `low_stock:${id}:${buy}` },
    ]);
  });

  it('không có admin nhận (admin_group không ai thuộc) → món không bị đánh dấu, có admin lại thì báo', async () => {
    const id = await newItem('Gôm');
    await purchase(id, 10);
    await issueTo(id, 8);
    await f.setConfig({ admin_group: `nobody-${f.SUFFIX}` });
    try {
      await f.run(NOW);
      expect(await notifiedAt(id)).toBeNull();
    } finally {
      await f.setConfig({ admin_group: f.adminGroup() });
    }
    await f.run(NOW);
    expect(await lowEvents(id)).toHaveLength(2);
  });
});
