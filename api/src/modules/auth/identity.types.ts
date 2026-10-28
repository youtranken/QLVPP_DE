import type { Request } from 'express';

export interface RequestIdentity {
  sub: string;
  role: string;
  devMode: boolean;
  sessionId?: string;
  fullName?: string;
  email?: string;
}

export type AuthedRequest = Request & {
  user?: RequestIdentity;
  cookies?: Record<string, string>;
};
