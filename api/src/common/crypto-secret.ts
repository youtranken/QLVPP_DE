import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

type EnvLike = Record<string, string | undefined>;

// Cùng tên biến và định dạng với QLHS: chuỗi bất kỳ, khóa AES = sha256(CONFIG_ENC_KEY).
// Sinh: openssl rand -base64 32. Khóa chỉ nằm ở env, không bao giờ trong DB.
export const ENC_KEY_ENV = 'CONFIG_ENC_KEY';
const MIN_KEY_LENGTH = 32;

export function hasEncKey(env: EnvLike = process.env): boolean {
  return !!env[ENC_KEY_ENV];
}

// Kiểm lúc khởi động: prod thiếu khóa → từ chối; có khóa thì phải đủ dài, không còn placeholder
export function assertEncKeyEnv(env: EnvLike): void {
  const raw = env[ENC_KEY_ENV];
  if (!raw) {
    if (env.NODE_ENV === 'production') {
      throw new Error(
        `Thiếu ${ENC_KEY_ENV} — production bắt buộc có khóa mã hóa token phiên. ` +
          'Sinh: openssl rand -base64 32. Từ chối khởi động (fail-closed).',
      );
    }
    return;
  }
  if (raw.length < MIN_KEY_LENGTH || /CHANGE_ME/i.test(raw)) {
    throw new Error(
      `${ENC_KEY_ENV} phải dài ≥ ${MIN_KEY_LENGTH} ký tự và không phải placeholder ` +
        '(sinh: openssl rand -base64 32). Từ chối khởi động.',
    );
  }
}

// Dẫn xuất khóa một lần cho mỗi giá trị env (test đổi env giữa chừng thì dẫn xuất lại)
let cached: { raw: string; key: Buffer } | undefined;

function key(): Buffer {
  const raw = process.env[ENC_KEY_ENV];
  if (!raw) {
    throw new Error(
      `${ENC_KEY_ENV} chưa cấu hình — không mã hóa/giải mã được.`,
    );
  }
  if (cached?.raw !== raw) {
    cached = { raw, key: createHash('sha256').update(raw).digest() };
  }
  return cached.key;
}

// AES-256-GCM: iv.tag.data (base64) — tag làm sửa đổi tự lộ; aad (nếu có) phải khớp lúc giải mã
export function encryptSecret(plain: string, aad?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  if (aad !== undefined) cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${ct.toString('base64')}`;
}

export function decryptSecret(enc: string, aad?: string): string {
  const [ivB, tagB, ctB] = enc.split('.');
  if (!ivB || !tagB || !ctB) throw new Error('Ciphertext sai định dạng.');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key(),
    Buffer.from(ivB, 'base64'),
  );
  if (aad !== undefined) decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(Buffer.from(tagB, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
