import { createHmac } from 'node:crypto';
import { Router } from 'express';
import express from 'express';
import { APP_INTERNAL_BASE_URL, WEBHOOK_SECRET } from './config';
import { DEMO_USERS } from './users';

/**
 * Phát webhook thủ công để thử luồng AUTH-4 mà không cần PMH ID thật
 * (SSO-INTEGRATION §9 — "nút phát webhook thủ công để test khoá user").
 * Ký HMAC-SHA256 v2 trên `${ts}.${body}` đúng như PMH ID thật.
 */
export function createWebhookEmitterRouter(): Router {
  const router = Router();
  router.use(express.json());

  router.post('/admin/emit-webhook', async (req, res) => {
    const { event, sub, groups } = req.body as {
      event?: string;
      sub?: string;
      groups?: string[];
    };
    if (!event || !sub) {
      res.status(400).json({ error: 'Cần có `event` và `sub`' });
      return;
    }

    const body = JSON.stringify({ event, sub, groups });
    const timestamp = String(Date.now());
    const signature = createHmac('sha256', WEBHOOK_SECRET)
      .update(`${timestamp}.${body}`)
      .digest('hex');
    const target = `${APP_INTERNAL_BASE_URL}/api/webhooks/pmh-id`;

    try {
      const response = await fetch(target, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PMH-Timestamp': timestamp,
          'X-PMH-Signature-V2': signature,
        },
        body,
      });
      res.status(200).json({
        target,
        status: response.status,
        response: await response.text(),
      });
    } catch (error) {
      res.status(502).json({ target, error: (error as Error).message });
    }
  });

  /** Trang nhỏ liệt kê user demo để bấm phát sự kiện khi demo bằng trình duyệt. */
  router.get('/admin/webhooks', (_req, res) => {
    const rows = DEMO_USERS.map((user) => `<li><code>${user.sub}</code> — ${user.email}</li>`).join(
      '',
    );
    res.type('html').send(
      `<h1>Phát webhook thủ công</h1>
       <p>POST <code>/admin/emit-webhook</code> với body
          <code>{"event":"user.locked","sub":"usr_an"}</code></p>
       <p>Sự kiện: <code>user.locked</code>, <code>user.unlocked</code>,
          <code>user.deleted</code>, <code>user.groups_changed</code> (kèm <code>groups</code>),
          <code>user.password_changed</code>.</p>
       <p>Gửi tới: <code>${APP_INTERNAL_BASE_URL}/api/webhooks/pmh-id</code></p>
       <ul>${rows}</ul>`,
    );
  });

  return router;
}
