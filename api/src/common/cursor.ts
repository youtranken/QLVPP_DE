import { BadRequestException } from '@nestjs/common';

export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 200;

export function encodeCursor(keys: string[]): string {
  return Buffer.from(JSON.stringify(keys)).toString('base64url');
}

export function decodeCursor(raw: string, size: number): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    parsed = null;
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== size ||
    parsed.some((k) => typeof k !== 'string')
  ) {
    throw new BadRequestException('cursor không hợp lệ');
  }
  return parsed as string[];
}
