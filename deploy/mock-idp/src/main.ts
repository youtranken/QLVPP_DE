import express from 'express';
import { ISSUER, PORT, REDIRECT_URI } from './config';
import { createDirectoryRouter } from './directory';
import { createInteractionRouter } from './interaction';
import { createProvider } from './provider';
import { createWebhookEmitterRouter } from './webhook-emitter';

/**
 * IdP OIDC giả lập PMH ID cho demo/dev (SSO-INTEGRATION §9).
 * KHÔNG dùng ở môi trường thật: khoá ký sinh mỗi lần khởi động, không có mật khẩu.
 */
async function main(): Promise<void> {
  const provider = await createProvider();

  // Log việc gửi back-channel logout — thiếu log này thì BCL hỏng rất khó lần ra.
  provider.on('backchannel.success', (_ctx, client, accountId) => {
    console.log(`backchannel logout ➜ ${client.clientId} (sub=${accountId}) OK`);
  });
  provider.on('backchannel.error', (_ctx, error, client, accountId) => {
    console.error(`backchannel logout ➜ ${client.clientId} (sub=${accountId}) LỖI:`, error);
  });
  provider.on('server_error', (_ctx, error) => {
    console.error('oidc-provider server_error:', error);
  });

  const app = express();

  app.use(express.urlencoded({ extended: false }));
  app.use(createInteractionRouter(provider));
  app.use(createDirectoryRouter(provider));
  app.use(createWebhookEmitterRouter());

  // Provider mount ở /oidc để issuer có cùng hình dạng với PMH ID thật (.../oidc).
  app.use('/oidc', provider.callback());

  app.get('/', (_req, res) => {
    res.type('html').send(
      `<h1>Mock PMH ID</h1>
       <p>Issuer: <code>${ISSUER}</code></p>
       <p>Discovery: <a href="/oidc/.well-known/openid-configuration">/oidc/.well-known/openid-configuration</a></p>
       <p>Redirect URI đã khai: <code>${REDIRECT_URI}</code></p>`,
    );
  });

  app.listen(PORT, () => {
    console.log(`mock-idp listening on :${PORT} — issuer ${ISSUER}`);
  });
}

main().catch((error: unknown) => {
  console.error('mock-idp không khởi động được:', error);
  process.exit(1);
});
