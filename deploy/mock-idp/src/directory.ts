import { Router, type RequestHandler } from 'express';
import type Provider from 'oidc-provider';
import { DEMO_GROUPS, DEMO_USERS } from './users';

/**
 * Directory API giả lập (SSO-INTEGRATION §7) — bảo vệ bằng token client_credentials.
 * Chỉ đủ hình dạng để job đồng bộ danh bạ ở M2 chạy được end-to-end.
 */
export function createDirectoryRouter(provider: Provider): Router {
  const router = Router();

  const requireM2mToken: RequestHandler = (req, res, next) => {
    const header = req.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      res.status(401).json({ error: 'missing_token' });
      return;
    }
    provider.ClientCredentials.find(token)
      .then((granted) => {
        if (!granted || granted.isExpired) {
          res.status(401).json({ error: 'invalid_token' });
          return;
        }
        next();
      })
      .catch(next);
  };

  router.use('/api/v1', requireM2mToken);

  /** Danh bạ, phân trang theo `limit`/`offset` như OpenAPI của PMH ID. */
  router.get('/api/v1/users', (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 100), 500);
    const offset = Number(req.query.offset ?? 0);
    res.json({
      total: DEMO_USERS.length,
      limit,
      offset,
      items: DEMO_USERS.slice(offset, offset + limit).map((user) => ({
        sub: user.sub,
        email: user.email,
        full_name: user.full_name,
        employee_code: user.employee_code,
        groups: user.groups,
        disabled: false,
      })),
    });
  });

  /** Group mà client này được phép thấy — webhook KHÔNG thay được, phải fetch (qlts-notes). */
  router.get('/api/v1/groups', (_req, res) => {
    res.json({ items: DEMO_GROUPS.map((name) => ({ name })) });
  });

  /** Đồng bộ tăng dần. Mock chưa sinh sự kiện thật, luôn trả rỗng với cursor mới. */
  router.get('/api/v1/events', (req, res) => {
    res.json({ items: [], next_cursor: String(req.query.since ?? '0') });
  });

  return router;
}
