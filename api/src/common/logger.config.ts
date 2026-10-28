import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Options } from 'pino-http';

const SECRET_QUERY_KEYS = ['code', 'state', 'login_hint', 'logout_token'];

function stripQuery(url: unknown): unknown {
  return typeof url === 'string' ? url.split('?')[0] : url;
}

export function httpLoggerOptions(): Options {
  return {
    genReqId: (req: IncomingMessage) =>
      (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        ...SECRET_QUERY_KEYS.map((k) => `req.query.${k}`),
        'req.body.logout_token',
      ],
      censor: '[REDACTED]',
    },
    serializers: {
      req: (req: Record<string, unknown>) => ({
        ...req,
        url: stripQuery(req.url),
      }),
    },
    customProps: (req) => ({ request_id: (req as { id?: unknown }).id }),
  };
}
