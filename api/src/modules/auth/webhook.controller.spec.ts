import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { WebhookController } from './webhook.controller';

const SECRET = 'whsec-test';

function makeController(alreadyProcessed = false) {
  const events = { apply: jest.fn().mockResolvedValue(undefined) };
  const audit = { append: jest.fn().mockResolvedValue(undefined) };
  // db.execute dùng cho isProcessed (SELECT đầu) + markProcessed (INSERT cuối).
  // alreadyProcessed=true → SELECT trả 1 dòng → replay bị bỏ qua.
  const db = {
    execute: jest
      .fn()
      .mockResolvedValue({ rows: alreadyProcessed ? [{ event_id: 'e' }] : [] }),
  };
  const controller = new WebhookController(
    events as never,
    audit as never,
    db as never,
  );
  return { controller, events, audit, db };
}

const nowTs = () => String(Math.floor(Date.now() / 1000));

function signV2(rawBody: Buffer, ts: string, secret = SECRET): string {
  return createHmac('sha256', secret)
    .update(`${ts}.${rawBody.toString('utf8')}`)
    .digest('hex');
}

function signedReq(body: object, secret = SECRET) {
  const rawBody = Buffer.from(JSON.stringify(body));
  const ts = nowTs();
  return { rawBody, ts, signature: signV2(rawBody, ts, secret) };
}

describe('WebhookController — HMAC v2, parse v3, chống trùng', () => {
  beforeAll(() => {
    process.env.PMH_WEBHOOK_SECRET = SECRET;
  });
  afterAll(() => {
    delete process.env.PMH_WEBHOOK_SECRET;
  });

  it('chữ ký đúng + payload v3 → giao WebhookEventsService rồi mới đánh dấu processed', async () => {
    const { controller, events, db } = makeController();
    const { rawBody, ts, signature } = signedReq({
      type: 'user.access_revoked',
      user_id: 'usr_1',
      event_id: '42',
      department: 'Phòng D&E',
      team: null,
      app_role: 'member',
      detail: { client_id: 'client_vpp', extra: 1 },
      at: '2026-11-08T03:00:00.000Z',
      groups: ['bỏ qua'],
    });
    const result = await controller.handle({ rawBody } as never, signature, ts);
    expect(result).toEqual({ ok: true });
    expect(events.apply).toHaveBeenCalledWith({
      type: 'user.access_revoked',
      user_id: 'usr_1',
      event_id: '42',
      department: 'Phòng D&E',
      team: null,
      app_role: 'member',
      detail: { client_id: 'client_vpp', change: undefined },
      at: '2026-11-08T03:00:00.000Z',
    });
    // SELECT processed → apply → INSERT processed
    expect(db.execute).toHaveBeenCalledTimes(2);
    expect(events.apply.mock.invocationCallOrder[0]).toBeLessThan(
      db.execute.mock.invocationCallOrder[1],
    );
  });

  it('event_id đã xử → lần 2 trả {duplicate:true}, KHÔNG xử lại', async () => {
    const { controller, events } = makeController(true);
    const { rawBody, ts, signature } = signedReq({
      type: 'user.locked',
      user_id: 'usr_1',
      event_id: '123',
    });
    const result = await controller.handle({ rawBody } as never, signature, ts);
    expect(result).toEqual({ ok: true, duplicate: true });
    expect(events.apply).not.toHaveBeenCalled();
  });

  it('xử lý lỗi → không đánh dấu processed (PMH ID retry sẽ xử lại)', async () => {
    const { controller, events, db } = makeController();
    events.apply.mockRejectedValue(new Error('db down'));
    const { rawBody, ts, signature } = signedReq({
      type: 'user.locked',
      user_id: 'usr_1',
      event_id: '5',
    });
    await expect(
      controller.handle({ rawBody } as never, signature, ts),
    ).rejects.toThrow('db down');
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['thiếu event_id', {}],
    ['event_id "abc"', { event_id: 'abc' }],
    ['event_id số', { event_id: 12 }],
    ['event_id âm', { event_id: '-1' }],
    ['event_id thập phân', { event_id: '1.5' }],
    ['event_id rỗng', { event_id: '' }],
    ['team là số', { event_id: '1', team: 3 }],
    ['detail là chuỗi', { event_id: '1', detail: 'x' }],
    ['detail là mảng', { event_id: '1', detail: [] }],
    ['user_id rỗng', { event_id: '1', user_id: '' }],
  ])('%s → 400 WEBHOOK_PAYLOAD_INVALID, không xử lý', async (_n, extra) => {
    const { controller, events } = makeController();
    const { rawBody, ts, signature } = signedReq({
      type: 'user.locked',
      user_id: 'usr_1',
      ...extra,
    });
    await expect(
      controller.handle({ rawBody } as never, signature, ts),
    ).rejects.toMatchObject({
      status: 400,
      response: expect.objectContaining({ code: 'WEBHOOK_PAYLOAD_INVALID' }),
    });
    expect(events.apply).not.toHaveBeenCalled();
  });

  it('department/app_role không phải chuỗi → bỏ qua trường đó (không 400)', async () => {
    const { controller, events } = makeController();
    const { rawBody, ts, signature } = signedReq({
      type: 'user.groups_changed',
      user_id: 'usr_1',
      event_id: '7',
      department: 5,
      app_role: ['admin'],
    });
    await controller.handle({ rawBody } as never, signature, ts);
    expect(events.apply).toHaveBeenCalledWith(
      expect.objectContaining({ department: undefined, app_role: undefined }),
    );
  });

  it('sai chữ ký → 401, KHÔNG xử lý, audit webhook_rejected', async () => {
    const { controller, events, audit } = makeController();
    const { rawBody, ts } = signedReq({
      type: 'user.locked',
      user_id: 'usr_1',
    });
    const bad = signV2(rawBody, ts, 'secret-khac');
    await expect(
      controller.handle({ rawBody } as never, bad, ts),
    ).rejects.toThrow(UnauthorizedException);
    expect(events.apply).not.toHaveBeenCalled();
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.webhook_rejected',
        detail: { reason: 'mismatch' },
      }),
    );
  });

  it('chỉ có chữ ký v1 (x-pmh-signature, không V2/timestamp) → 401, không xử lý', async () => {
    const { controller, events, audit } = makeController();
    const rawBody = Buffer.from(
      JSON.stringify({ type: 'user.locked', user_id: 'usr_1' }),
    );
    const v1 = createHmac('sha256', SECRET).update(rawBody).digest('hex');
    await expect(
      controller.handle(
        { rawBody, headers: { 'x-pmh-signature': v1 } } as never,
        undefined,
        undefined,
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(events.apply).not.toHaveBeenCalled();
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { reason: 'missing' } }),
    );
  });

  it('timestamp cũ hơn WEBHOOK_TS_SKEW_SEC (300) → 401 skew dù chữ ký đúng', async () => {
    const { controller, events, audit } = makeController();
    const rawBody = Buffer.from(
      JSON.stringify({ type: 'user.locked', user_id: 'usr_1' }),
    );
    const ts = String(Math.floor(Date.now() / 1000) - 301);
    await expect(
      controller.handle({ rawBody } as never, signV2(rawBody, ts), ts),
    ).rejects.toThrow(UnauthorizedException);
    expect(events.apply).not.toHaveBeenCalled();
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { reason: 'skew' } }),
    );
  });

  it('WEBHOOK_TS_SKEW_SEC=600 → ts lệch 400 s vẫn nhận', async () => {
    process.env.WEBHOOK_TS_SKEW_SEC = '600';
    try {
      const { controller, events } = makeController();
      const rawBody = Buffer.from(
        JSON.stringify({
          type: 'user.locked',
          user_id: 'usr_1',
          event_id: '1',
        }),
      );
      const ts = String(Math.floor(Date.now() / 1000) - 400);
      await controller.handle({ rawBody } as never, signV2(rawBody, ts), ts);
      expect(events.apply).toHaveBeenCalled();
    } finally {
      delete process.env.WEBHOOK_TS_SKEW_SEC;
    }
  });

  it('chữ ký khác ĐỘ DÀI → 401 sạch, không crash (timingSafeEqual edge)', async () => {
    const { controller } = makeController();
    const { rawBody, ts } = signedReq({
      type: 'user.locked',
      user_id: 'usr_1',
    });
    await expect(
      controller.handle({ rawBody } as never, 'ngắn', ts),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('chữ ký ĐÚNG nhưng payload hỏng → 400 (không 500 để PMH ID retry mãi)', async () => {
    const { controller } = makeController();
    for (const bad of [
      'null',
      '"chuoi"',
      '{"type":123}',
      '{"type":"user.locked"}',
      '{"type":"user.locked","user_id":"u"}',
      'not-json',
    ]) {
      const rawBody = Buffer.from(bad);
      const ts = nowTs();
      await expect(
        controller.handle({ rawBody } as never, signV2(rawBody, ts), ts),
      ).rejects.toMatchObject({ status: 400 });
    }
  });

  it('thiếu rawBody → 401', async () => {
    const { controller } = makeController();
    const { ts, signature } = signedReq({
      type: 'user.locked',
      user_id: 'usr_1',
    });
    await expect(
      controller.handle({ rawBody: undefined } as never, signature, ts),
    ).rejects.toThrow(UnauthorizedException);
  });
});
