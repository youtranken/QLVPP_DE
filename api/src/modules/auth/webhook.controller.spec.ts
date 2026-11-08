import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { WebhookController } from './webhook.controller';

const SECRET = 'whsec-test';

function makeController(alreadyProcessed = false) {
  const sessions = { destroyAllForUser: jest.fn().mockResolvedValue(2) };
  const users = {
    setStatus: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { append: jest.fn().mockResolvedValue(undefined) };
  // db.execute dùng cho isProcessed (SELECT đầu) + markProcessed (INSERT cuối).
  // alreadyProcessed=true → SELECT trả 1 dòng → replay bị bỏ qua.
  const db = {
    execute: jest
      .fn()
      .mockResolvedValue({ rows: alreadyProcessed ? [{ event_id: 'e' }] : [] }),
  };
  const controller = new WebhookController(
    sessions as never,
    users as never,
    audit as never,
    db as never,
  );
  return { controller, sessions, users, audit, db };
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

describe('WebhookController — HMAC v2 + đá phiên', () => {
  beforeAll(() => {
    process.env.PMH_WEBHOOK_SECRET = SECRET;
  });
  afterAll(() => {
    delete process.env.PMH_WEBHOOK_SECRET;
  });

  it('chữ ký đúng + user.locked → hủy phiên + set status locked + audit system(webhook)', async () => {
    const { controller, sessions, users, audit } = makeController();
    const { rawBody, ts, signature } = signedReq({
      type: 'user.locked',
      user_id: 'usr_1',
    });
    const result = await controller.handle({ rawBody } as never, signature, ts);
    expect(result).toEqual({ ok: true });
    expect(sessions.destroyAllForUser).toHaveBeenCalledWith('usr_1');
    expect(users.setStatus).toHaveBeenCalledWith('usr_1', 'locked');
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'system(webhook)',
        action: 'auth.session_revoked',
      }),
    );
  });

  it('event_id đã xử → lần 2 trả {duplicate:true}, KHÔNG đá phiên lại', async () => {
    const { controller, sessions, users } = makeController(true);
    const { rawBody, ts, signature } = signedReq({
      type: 'user.locked',
      user_id: 'usr_1',
      event_id: 'evt-123',
    });
    const result = await controller.handle({ rawBody } as never, signature, ts);
    expect(result).toEqual({ ok: true, duplicate: true });
    expect(sessions.destroyAllForUser).not.toHaveBeenCalled();
    expect(users.setStatus).not.toHaveBeenCalled();
  });

  it('user.deleted → set status deleted', async () => {
    const { controller, users } = makeController();
    const { rawBody, ts, signature } = signedReq({
      type: 'user.deleted',
      user_id: 'usr_9',
    });
    await controller.handle({ rawBody } as never, signature, ts);
    expect(users.setStatus).toHaveBeenCalledWith('usr_9', 'deleted');
  });

  it('user.groups_changed (payload v1 có groups) → không đụng users, không đá phiên', async () => {
    const { controller, sessions, users } = makeController();
    const { rawBody, ts, signature } = signedReq({
      type: 'user.groups_changed',
      user_id: 'usr_1',
      groups: ['Kế toán'],
    });
    const result = await controller.handle({ rawBody } as never, signature, ts);
    expect(result).toEqual({ ok: true });
    expect(users.setStatus).not.toHaveBeenCalled();
    expect(sessions.destroyAllForUser).not.toHaveBeenCalled();
  });

  it('sai chữ ký → 401, KHÔNG xử lý, audit webhook_rejected', async () => {
    const { controller, sessions, audit } = makeController();
    const { rawBody, ts } = signedReq({
      type: 'user.locked',
      user_id: 'usr_1',
    });
    const bad = signV2(rawBody, ts, 'secret-khac');
    await expect(
      controller.handle({ rawBody } as never, bad, ts),
    ).rejects.toThrow(UnauthorizedException);
    expect(sessions.destroyAllForUser).not.toHaveBeenCalled();
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.webhook_rejected',
        detail: { reason: 'mismatch' },
      }),
    );
  });

  it('chỉ có chữ ký v1 (x-pmh-signature, không V2/timestamp) → 401, không xử lý', async () => {
    const { controller, sessions, audit } = makeController();
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
    expect(sessions.destroyAllForUser).not.toHaveBeenCalled();
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { reason: 'missing' } }),
    );
  });

  it('timestamp cũ hơn WEBHOOK_TS_SKEW_SEC (300) → 401 skew dù chữ ký đúng', async () => {
    const { controller, sessions, audit } = makeController();
    const rawBody = Buffer.from(
      JSON.stringify({ type: 'user.locked', user_id: 'usr_1' }),
    );
    const ts = String(Math.floor(Date.now() / 1000) - 301);
    await expect(
      controller.handle({ rawBody } as never, signV2(rawBody, ts), ts),
    ).rejects.toThrow(UnauthorizedException);
    expect(sessions.destroyAllForUser).not.toHaveBeenCalled();
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { reason: 'skew' } }),
    );
  });

  it('WEBHOOK_TS_SKEW_SEC=600 → ts lệch 400 s vẫn nhận', async () => {
    process.env.WEBHOOK_TS_SKEW_SEC = '600';
    try {
      const { controller, sessions } = makeController();
      const rawBody = Buffer.from(
        JSON.stringify({ type: 'user.locked', user_id: 'usr_1' }),
      );
      const ts = String(Math.floor(Date.now() / 1000) - 400);
      await controller.handle({ rawBody } as never, signV2(rawBody, ts), ts);
      expect(sessions.destroyAllForUser).toHaveBeenCalledWith('usr_1');
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
