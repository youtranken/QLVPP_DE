import { lineNotifyFixture } from './line-notify.fixture';

describe('admin/lines/:id/review: chuông line_review cho chủ phiếu', () => {
  const f = lineNotifyFixture('review-notify');
  const {
    A,
    B,
    bells,
    breakNotifications,
    customLine,
    lineRow,
    newItem,
    pool,
    repairNotifications,
    review,
  } = f;

  it('reject "Không mua được" → chủ phiếu có đúng 1 chuông, params + link /history/2026-11; review lần 2 → 409, vẫn 1', async () => {
    const { line } = await customLine(A, 'Bìa còng X1');
    await review(line.id, {
      action: 'reject',
      note: ' Không mua được ',
    }).expect(200);
    const again = await review(line.id, { action: 'accept' });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('LINE_ALREADY_REVIEWED');
    expect(await bells('line_review', A)).toEqual([
      {
        event_id: `line_review:${line.id}`,
        params: {
          ym: '2026-11',
          action: 'rejected',
          name: 'Bìa còng X1',
          note: 'Không mua được',
        },
        link: '/history/2026-11',
      },
    ]);
    expect(await bells('line_review', f.ADMIN)).toEqual([]);
  });

  it('reject lý do thiếu/ngắn (400), dòng không có (404), xử lý lần 2 → không chuông nào mới', async () => {
    const { line } = await customLine(B, 'Bìa còng X2');
    for (const note of [undefined, ' ab ']) {
      await review(line.id, { action: 'reject', note }).expect(400);
    }
    await review('00000000-0000-4000-8000-000000000000', {
      action: 'accept',
    }).expect(404);
    expect(await bells('line_review', B)).toEqual([]);
  });

  it('accept → params action accepted, không item_name; note tùy chọn', async () => {
    const { line } = await customLine(A, 'Bìa còng X3');
    await review(line.id, { action: 'accept' }).expect(200);
    const rows = await bells('line_review', A);
    const mine = rows.find((r) => r.event_id === `line_review:${line.id}`)!;
    expect(mine.params).toEqual({
      ym: '2026-11',
      action: 'accepted',
      name: 'Bìa còng X3',
    });
  });

  it('convert sang món mới → params.item_name = tên món mới; convert món có sẵn → tên món đó', async () => {
    const first = await customLine(A, 'Bìa còng X4');
    const body = f.newItemBody({ name_en: 'Binder' });
    await review(first.line.id, { action: 'convert', item: body }).expect(200);
    const second = await customLine(B, 'Bìa còng X5');
    const existing = await newItem();
    const existingName = (
      await pool().query<{ name: string }>(
        'SELECT name FROM items WHERE id = $1',
        [existing],
      )
    ).rows[0].name;
    await review(second.line.id, {
      action: 'convert',
      item: { existing_id: existing },
    }).expect(200);
    const a = (await bells('line_review', A)).find(
      (r) => r.event_id === `line_review:${first.line.id}`,
    )!;
    expect(a.params).toMatchObject({
      action: 'converted',
      name: 'Bìa còng X4',
      item_name: body.name,
      item_name_en: 'Binder',
    });
    const b = (await bells('line_review', B)).find(
      (r) => r.event_id === `line_review:${second.line.id}`,
    )!;
    expect(b.params).toMatchObject({
      action: 'converted',
      item_name: existingName,
    });
  });

  it('ghi chuông lỗi (trigger RAISE) → review vẫn 200, dòng đã rejected, audit còn', async () => {
    const { line } = await customLine(A, 'Bìa còng X6');
    await breakNotifications();
    try {
      await review(line.id, {
        action: 'reject',
        note: 'Không mua được',
      }).expect(200);
    } finally {
      await repairNotifications();
    }
    expect((await lineRow(line.id)).review_status).toBe('rejected');
    expect(
      (await bells('line_review', A)).filter(
        (r) => r.event_id === `line_review:${line.id}`,
      ),
    ).toEqual([]);
  });
});
