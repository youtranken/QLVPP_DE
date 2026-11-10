import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AuditWriterService } from '../audit/audit-writer.service';
import { toAppRole, UsersService } from '../users/users.service';
import { JwtVerifierService } from './jwt-verifier.service';
import {
  LOCAL_SA_EMAIL,
  LOCAL_SA_FULL_NAME,
  LOCAL_SA_IDLE_MS,
  LOCAL_SA_SUB,
} from './local-sa-env';
import { LOCAL_TEST_SUB_PREFIX } from './local-test-accounts-env';
import { LocalTestAccountsService } from './local-test-accounts.service';
import { OIDC_PROVIDER } from './oidc-provider';
import type { OidcProvider } from './oidc-provider';
import { SessionService } from './session.service';
import type { SessionRecord } from './session.service';
import type { RequestIdentity } from './identity.types';
import type { PmhIdClaims } from '../users/users.service';
import { TokenContractError } from './token-contract.error';

// Phiên SSO PMH ID (có token PMH ID) — không phải SA local, tài khoản thử dev
export function isPmhSession(session: SessionRecord): boolean {
  return (
    session.claims !== null &&
    session.userSub !== LOCAL_SA_SUB &&
    !session.userSub.startsWith(LOCAL_TEST_SUB_PREFIX)
  );
}

// Refresh single-flight theo phiên: nhiều tab song song mà refresh nhiều lần sẽ đốt refresh token
// xoay vòng single-use rồi logout oan. PMH ID sập → giữ phiên, 503 (không biến outage thành logout).
@Injectable()
export class SessionAuthService {
  private readonly logger = new Logger(SessionAuthService.name);
  private readonly inflight = new Map<
    string,
    Promise<RequestIdentity | null>
  >();
  // Một lượt refresh token / phiên dùng chung cho resolve() và refreshNow() — refresh token xoay
  // vòng single-use, hai lượt chồng nhau thì lượt sau invalid_grant → logout oan
  private readonly refreshing = new Map<string, Promise<PmhIdClaims | null>>();

  constructor(
    private readonly sessions: SessionService,
    private readonly jwtVerifier: JwtVerifierService,
    @Inject(OIDC_PROVIDER) private readonly oidc: OidcProvider,
    private readonly audit: AuditWriterService,
    private readonly users: UsersService,
    private readonly testAccounts: LocalTestAccountsService,
  ) {}

  resolve(sessionId: string): Promise<RequestIdentity | null> {
    const existing = this.inflight.get(sessionId);
    if (existing) {
      return existing;
    }
    // Set đồng bộ trước mọi await — đóng cửa sổ race giữa get và set
    const promise = this.doResolve(sessionId).finally(() =>
      this.inflight.delete(sessionId),
    );
    this.inflight.set(sessionId, promise);
    return promise;
  }

  private async doResolve(sessionId: string): Promise<RequestIdentity | null> {
    const session = await this.sessions.find(sessionId);
    if (!session) {
      return null;
    }

    // Phiên SA local: không claims OIDC, không refresh; idle quá 2 h → buộc login lại
    if (session.userSub === LOCAL_SA_SUB) {
      const idleMs = Date.now() - session.lastSeenAt.getTime();
      if (idleMs > LOCAL_SA_IDLE_MS) {
        await this.expire(sessionId, LOCAL_SA_SUB, 'local_sa_idle');
        return null;
      }
      await this.sessions.touchLastSeen(sessionId);
      return {
        sub: LOCAL_SA_SUB,
        role: 'sa',
        devMode: false,
        sessionId,
        fullName: LOCAL_SA_FULL_NAME,
        email: LOCAL_SA_EMAIL,
      };
    }

    if (session.userSub.startsWith(LOCAL_TEST_SUB_PREFIX)) {
      return this.resolveLocalTest(sessionId, session.userSub);
    }

    if (!session.claims) {
      return null;
    }

    const stillValid =
      session.accessTokenExp !== null &&
      session.accessTokenExp.getTime() > Date.now();

    if (stillValid) {
      return this.toIdentity(sessionId, session.claims);
    }
    return this.refreshSession(sessionId);
  }

  // Tài khoản thử local (chỉ dev): vai lấy từ env mỗi request; tắt biến → phiên cũ chết ngay
  private async resolveLocalTest(
    sessionId: string,
    sub: string,
  ): Promise<RequestIdentity | null> {
    const account = this.testAccounts.findBySub(sub);
    if (!account) {
      await this.expire(sessionId, sub, 'local_test_disabled');
      return null;
    }
    return {
      sub,
      role: account.role,
      devMode: false,
      sessionId,
      fullName: account.name,
      email: account.email ?? undefined,
    };
  }

  private async refreshSession(
    sessionId: string,
  ): Promise<RequestIdentity | null> {
    const claims = await this.refreshTokensOnce(sessionId);
    return claims ? this.toIdentity(sessionId, claims) : null;
  }

  /**
   * Refresh NGAY dù access token còn hạn (lưu ngôn ngữ PMH ID: 401 → refresh rồi thử lại; lưu xong →
   * refresh để claims phiên mang locale mới). Dùng chung single-flight với resolve(). Trả phiên sau
   * refresh; null = phiên không còn / không phải SSO / PMH ID từ chối (phiên đã bị hủy). PMH ID sập → ném.
   */
  async refreshNow(sessionId: string): Promise<SessionRecord | null> {
    const session = await this.sessions.find(sessionId);
    if (!session || !isPmhSession(session)) {
      return null;
    }
    const claims = await this.refreshTokensOnce(sessionId);
    return claims ? this.sessions.find(sessionId) : null;
  }

  private refreshTokensOnce(sessionId: string): Promise<PmhIdClaims | null> {
    const existing = this.refreshing.get(sessionId);
    if (existing) {
      return existing;
    }
    const promise = this.doRefreshTokens(sessionId).finally(() =>
      this.refreshing.delete(sessionId),
    );
    this.refreshing.set(sessionId, promise);
    return promise;
  }

  private async doRefreshTokens(
    sessionId: string,
  ): Promise<PmhIdClaims | null> {
    // Đọc lại: lượt refresh trước có thể vừa xoay refresh token. Phiên vừa bị xóa (logout,
    // back-channel) ⇒ dừng: không xin PMH ID bộ token mới bằng refresh token cũ
    const session = await this.sessions.find(sessionId);
    if (!session) {
      return null;
    }
    if (!session.refreshToken) {
      await this.expire(sessionId, session.userSub, 'no_refresh_token');
      return null;
    }
    try {
      const tokens = await this.oidc.refresh(session.refreshToken);
      const verified = await this.jwtVerifier.verify(tokens.accessToken);
      const updated = await this.sessions.updateTokens(sessionId, {
        refreshToken: tokens.refreshToken,
        accessToken: tokens.accessToken,
        accessTokenExp: verified.expiresAt,
        claims: verified.claims,
        // refresh có thể không phát id_token mới → giữ cái lúc login
        idToken: tokens.idToken ?? session.idToken,
      });
      if (!updated) {
        return null;
      }
      // Đổi vai trực tiếp trong DB của PMH ID có thể không phát webhook: lấy lại mỗi lần refresh
      await this.users.applyRole(
        verified.claims.sub,
        toAppRole(verified.claims.app_role),
        'refresh',
      );
      return verified.claims;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      // Token không mang hợp đồng v3 thì không biết vai: xử như bị thu hồi, không phải PMH ID sập
      if (error instanceof TokenContractError) {
        await this.expire(sessionId, session.userSub, 'token_ver');
        return null;
      }
      if (this.isRevocation(error)) {
        this.logger.log(
          `Refresh bị từ chối cho phiên ${sessionId}: ${(error as Error).message}`,
        );
        await this.expire(sessionId, session.userSub, 'refresh_failed');
        return null;
      }
      this.logger.warn(
        `Refresh lỗi không phân loại (giữ phiên ${sessionId}): ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException({
        code: 'SSO_UNAVAILABLE',
        message: 'Không liên lạc được PMH ID — vui lòng thử lại sau.',
      });
    }
  }

  private isRevocation(error: unknown): boolean {
    const oauthCode = (error as { error?: unknown }).error;
    if (typeof oauthCode === 'string') {
      return ['invalid_grant', 'invalid_token', 'unauthorized_client'].includes(
        oauthCode,
      );
    }
    return /invalid_grant|invalid_token|revoked|expired/i.test(
      (error as Error).message ?? '',
    );
  }

  // Vai từ users.role trong DB mỗi request (không từ claims phiên): webhook/sync/refresh ghi
  // role thì request kế có hiệu lực ngay. User không còn active (khóa/xóa/mất quyền vào VPP) thì
  // hủy phiên ở đây, để sync/webhook chỉ cần đổi status. 'sa' chỉ đến từ phiên local:sa ở doResolve.
  private async toIdentity(
    sessionId: string,
    claims: PmhIdClaims,
  ): Promise<RequestIdentity | null> {
    const user = await this.users.findBySub(claims.sub);
    if (user?.status !== 'active') {
      await this.expire(sessionId, claims.sub, 'user_inactive');
      return null;
    }
    const role = user.role === 'admin' ? 'admin' : 'member';
    return {
      sub: claims.sub,
      role,
      devMode: false,
      sessionId,
      fullName: claims.full_name,
      email: claims.email,
    };
  }

  private async expire(
    sessionId: string,
    userSub: string,
    reason: string,
  ): Promise<void> {
    await this.sessions.destroy(sessionId);
    await this.audit.append({
      actor: userSub,
      action: 'auth.session_expired',
      objectType: 'session',
      objectId: sessionId,
      detail: { reason },
    });
  }
}
