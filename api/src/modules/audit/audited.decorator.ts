import { SetMetadata } from '@nestjs/common';

export const AUDITED_KEY = 'vpp:audited';

export interface AuditedMeta {
  action: string;
  objectType?: string;
}

export const Audited = (action: string, objectType?: string) =>
  SetMetadata(AUDITED_KEY, { action, objectType } satisfies AuditedMeta);
