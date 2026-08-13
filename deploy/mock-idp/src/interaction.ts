import { Router } from 'express';
import type Provider from 'oidc-provider';
import { DEMO_USERS } from './users';

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string,
  );

function loginPage(uid: string): string {
  const rows = DEMO_USERS.map((user) => {
    const isAdmin = user.groups.includes('VPP-Admin');
    return `
      <form method="post" action="/interaction/${escapeHtml(uid)}/login">
        <input type="hidden" name="sub" value="${escapeHtml(user.sub)}" />
        <button type="submit" class="user">
          <span class="name">${escapeHtml(user.full_name)}</span>
          <span class="email">${escapeHtml(user.email)}</span>
          <span class="groups">${escapeHtml(user.groups.join(' · '))}</span>
          <span class="role ${isAdmin ? 'admin' : 'member'}">${isAdmin ? 'admin' : 'nhân viên'}</span>
        </button>
      </form>`;
  }).join('');

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PMH ID (giả lập) — Chọn người dùng</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: system-ui, sans-serif; margin: 0; padding: 32px 16px;
           display: flex; justify-content: center; background: #f5f6f8; }
    @media (prefers-color-scheme: dark) { body { background: #16181d; color: #e8e8ea; } }
    .box { width: 100%; max-width: 460px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    p.hint { margin: 0 0 20px; opacity: .7; font-size: 14px; }
    .user { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; width: 100%;
            text-align: left; padding: 12px 14px; margin-bottom: 8px; cursor: pointer;
            border: 1px solid rgba(128,128,128,.35); border-radius: 10px;
            background: white; font: inherit; }
    @media (prefers-color-scheme: dark) { .user { background: #1e2128; color: inherit; } }
    .user:hover { border-color: #3b82f6; }
    .name { font-weight: 600; }
    .email, .groups { grid-column: 1; font-size: 13px; opacity: .7; }
    .role { grid-row: 1 / span 3; align-self: center; font-size: 12px;
            padding: 3px 8px; border-radius: 999px; }
    .role.admin { background: #fde68a; color: #713f12; }
    .role.member { background: #dbeafe; color: #1e3a5f; }
  </style>
</head>
<body>
  <div class="box">
    <h1>PMH ID <em>(giả lập)</em></h1>
    <p class="hint">IdP demo — chọn một người dùng để đăng nhập vào DE-VPP. Không có mật khẩu.</p>
    ${rows}
  </div>
</body>
</html>`;
}

/**
 * Màn "đăng nhập" của IdP giả: bấm chọn 1 trong 6 user demo.
 * Consent được cấp tự động vì client là first-party (như PMH ID với app nội bộ).
 */
export function createInteractionRouter(provider: Provider): Router {
  const router = Router();

  router.get('/interaction/:uid', async (req, res, next) => {
    try {
      const { prompt, uid } = await provider.interactionDetails(req, res);
      if (prompt.name === 'login') {
        res.type('html').send(loginPage(uid));
        return;
      }
      // Các prompt khác (consent…) tự hoàn tất, xem POST /login bên dưới.
      res.redirect(`/interaction/${uid}/confirm`);
    } catch (error) {
      next(error);
    }
  });

  router.post('/interaction/:uid/login', async (req, res, next) => {
    try {
      const sub = String((req.body as { sub?: unknown }).sub ?? '');
      if (!DEMO_USERS.some((user) => user.sub === sub)) {
        res.status(400).send('Người dùng demo không hợp lệ');
        return;
      }
      await provider.interactionFinished(
        req,
        res,
        { login: { accountId: sub } },
        { mergeWithLastSubmission: false },
      );
    } catch (error) {
      next(error);
    }
  });

  /** Cấp consent tự động cho client first-party. */
  router.get('/interaction/:uid/confirm', async (req, res, next) => {
    try {
      const details = await provider.interactionDetails(req, res);
      const accountId = details.session?.accountId;
      const clientId = details.params.client_id as string;
      if (!accountId) {
        res.status(400).send('Chưa đăng nhập');
        return;
      }

      const grant = new provider.Grant({ accountId, clientId });
      grant.addOIDCScope(String(details.params.scope ?? 'openid'));
      const missingClaims = details.prompt.details.missingOIDCClaims as string[] | undefined;
      if (missingClaims?.length) grant.addOIDCClaims(missingClaims);
      const grantId = await grant.save();

      await provider.interactionFinished(
        req,
        res,
        { consent: { grantId } },
        { mergeWithLastSubmission: true },
      );
    } catch (error) {
      next(error);
    }
  });

  return router;
}
