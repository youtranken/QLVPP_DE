import { BadRequestException, PipeTransform } from '@nestjs/common';
import { isUuid } from '../../common/uuid';

export interface LineKey {
  key: string;
  item_id: string | null;
}

const CUSTOM = 'custom:';

// Đúng dạng jsonb_build_array(..)::text của CUSTOM_ITEM_KEY: dấu phẩy + khoảng trắng, chuỗi JSON thoát như jsonb
function customKey(raw: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(CUSTOM.length));
  } catch {
    return null;
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 2 ||
    !parsed.every((s) => typeof s === 'string' && s.length > 0)
  ) {
    return null;
  }
  const [name, unit] = parsed as string[];
  return `${CUSTOM}[${JSON.stringify(name)}, ${JSON.stringify(unit)}]`;
}

export function parseLineKey(raw: unknown): LineKey | null {
  if (typeof raw !== 'string') return null;
  if (isUuid(raw))
    return { key: raw.toLowerCase(), item_id: raw.toLowerCase() };
  if (!raw.startsWith(CUSTOM)) return null;
  return customKey(raw) === raw ? { key: raw, item_id: null } : null;
}

export function invalidLineKey(): BadRequestException {
  return new BadRequestException({
    code: 'VALIDATION',
    message: 'Khóa món không hợp lệ.',
    fields: ['line_key'],
  });
}

export class LineKeyPipe implements PipeTransform<unknown, LineKey> {
  transform(value: unknown): LineKey {
    const parsed = parseLineKey(value);
    if (!parsed) throw invalidLineKey();
    return parsed;
  }
}
