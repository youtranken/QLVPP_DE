import { createHmac, timingSafeEqual } from 'node:crypto';

export interface VerifyV2Input {
  secret: string;
  ts: string | undefined;
  rawBody: Buffer | undefined;
  signature: string | undefined;
  nowSec: number;
  skewSec: number;
}

export type VerifyV2Result =
  { ok: true } | { ok: false; reason: 'missing' | 'skew' | 'mismatch' };

// PMH ID gửi X-PMH-Timestamp là unix giây nguyên (docs/integration/README.md §6)
const UNIX_SECONDS = /^\d{1,11}$/;

export function verifyV2(input: VerifyV2Input): VerifyV2Result {
  const { secret, ts, rawBody, signature, nowSec, skewSec } = input;
  if (!ts || !signature || !rawBody) return { ok: false, reason: 'missing' };
  if (!UNIX_SECONDS.test(ts) || Math.abs(nowSec - Number(ts)) > skewSec) {
    return { ok: false, reason: 'skew' };
  }
  const expected = Buffer.from(
    createHmac('sha256', secret).update(`${ts}.`).update(rawBody).digest('hex'),
  );
  const provided = Buffer.from(signature);
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return { ok: false, reason: 'mismatch' };
  }
  return { ok: true };
}
