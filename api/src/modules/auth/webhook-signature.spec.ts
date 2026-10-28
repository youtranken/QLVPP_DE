import { createHmac } from 'node:crypto';
import { verifyV2 } from './webhook-signature';

const SECRET = 's';
const TS = '1761609600';
const BODY = '{"event_id":"e1","type":"user.locked","sub":"u1"}';
const EXPECTED = createHmac('sha256', SECRET)
  .update(`${TS}.${BODY}`)
  .digest('hex');

function input(overrides: Partial<Parameters<typeof verifyV2>[0]> = {}) {
  return {
    secret: SECRET,
    ts: TS,
    rawBody: Buffer.from(BODY),
    signature: EXPECTED,
    nowSec: Number(TS),
    skewSec: 300,
    ...overrides,
  };
}

describe('verifyV2 — HMAC-SHA256(secret, `${ts}.${rawBody}`)', () => {
  it('vector secret=s ts=1761609600 → ok', () => {
    expect(verifyV2(input())).toEqual({ ok: true });
  });

  it('lệch đúng 300 s vẫn ok, 301 s (cả hai phía) → skew', () => {
    expect(verifyV2(input({ nowSec: Number(TS) + 300 }))).toEqual({ ok: true });
    expect(verifyV2(input({ nowSec: Number(TS) + 301 }))).toEqual({
      ok: false,
      reason: 'skew',
    });
    expect(verifyV2(input({ nowSec: Number(TS) - 301 }))).toEqual({
      ok: false,
      reason: 'skew',
    });
  });

  it.each([
    ['ts', { ts: undefined }],
    ['signature', { signature: undefined }],
    ['ts rỗng', { ts: '' }],
    ['rawBody', { rawBody: undefined }],
  ])('thiếu %s → missing', (_label, overrides) => {
    expect(verifyV2(input(overrides))).toEqual({
      ok: false,
      reason: 'missing',
    });
  });

  it('ts không phải số giây nguyên → skew (không parse lỏng kiểu ms/ISO)', () => {
    for (const ts of ['abc', '1761609600000', '1761609600.5']) {
      expect(verifyV2(input({ ts }))).toEqual({ ok: false, reason: 'skew' });
    }
  });

  it('sai secret, sai body, khác độ dài → mismatch (không ném lỗi)', () => {
    expect(verifyV2(input({ secret: 'khac' }))).toEqual({
      ok: false,
      reason: 'mismatch',
    });
    expect(verifyV2(input({ rawBody: Buffer.from(`${BODY} `) }))).toEqual({
      ok: false,
      reason: 'mismatch',
    });
    expect(verifyV2(input({ signature: 'ngắn' }))).toEqual({
      ok: false,
      reason: 'mismatch',
    });
  });

  it('chữ ký v1 (HMAC trên body, không ts) → mismatch', () => {
    const v1 = createHmac('sha256', SECRET).update(BODY).digest('hex');
    expect(verifyV2(input({ signature: v1 }))).toEqual({
      ok: false,
      reason: 'mismatch',
    });
  });
});
