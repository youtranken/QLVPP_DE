import { Injectable } from '@nestjs/common';
import type { JWTPayload, JWTVerifyGetKey } from 'jose';
import { toAppRole } from '../users/users.service';
import type { PmhIdClaims } from '../users/users.service';
import { TEAM_MAX } from './auth-env';
import { TokenContractError } from './token-contract.error';

export const PMH_ID_CLAIMS_VERSION = 3;

export interface VerifiedAccessToken {
  claims: PmhIdClaims;
  expiresAt: Date | null;
  issuedAt: Date | null;
}

@Injectable()
export class JwtVerifierService {
  private jwks: JWTVerifyGetKey | null = null;
  private jwksUrl: string | null = null;
  private pinned = false;

  // Test bơm JWKS local (key tự sinh) thay vì remote
  setKeySource(getKey: JWTVerifyGetKey): void {
    this.jwks = getKey;
    this.pinned = true;
  }

  private async getKeySource(): Promise<JWTVerifyGetKey> {
    if (this.pinned && this.jwks) {
      return this.jwks;
    }
    const url = `${process.env.PMH_ISSUER_URL}/jwks`;
    if (this.jwks && this.jwksUrl === url) {
      return this.jwks;
    }
    const jose = await import('jose');
    this.jwks = jose.createRemoteJWKSet(new URL(url), {
      cacheMaxAge: 10 * 60 * 1000,
    });
    this.jwksUrl = url;
    return this.jwks;
  }

  async verify(accessToken: string): Promise<VerifiedAccessToken> {
    const jose = await import('jose');
    const getKey = await this.getKeySource();
    const { payload } = await jose.jwtVerify(accessToken, getKey, {
      issuer: process.env.PMH_ISSUER_URL,
      audience: process.env.PMH_CLIENT_ID,
      clockTolerance: 60,
    });
    // Thiếu sub → identity undefined; thiếu exp → refresh mỗi request
    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new Error('Access token thiếu claim `sub`');
    }
    if (!payload.exp) {
      throw new Error('Access token thiếu claim `exp`');
    }
    // Kiểm sau jwtVerify: chỉ tin `ver` khi chữ ký đúng. Token cũ không có app_role → không biết vai
    if (payload.ver !== PMH_ID_CLAIMS_VERSION) {
      throw new TokenContractError(payload.ver);
    }
    return {
      claims: this.toClaims(payload),
      expiresAt: new Date(payload.exp * 1000),
      issuedAt:
        typeof payload.iat === 'number' ? new Date(payload.iat * 1000) : null,
    };
  }

  // Bắt buộc `events` backchannel-logout và không có `nonce` — phân biệt với id_token bị dùng nhầm
  async verifyLogoutToken(logoutToken: string): Promise<{ sub: string }> {
    const jose = await import('jose');
    const getKey = await this.getKeySource();
    const { payload } = await jose.jwtVerify(logoutToken, getKey, {
      issuer: process.env.PMH_ISSUER_URL,
      audience: process.env.PMH_CLIENT_ID,
      clockTolerance: 60,
    });
    const events = payload.events as Record<string, unknown> | undefined;
    const isLogout =
      !!events &&
      'http://schemas.openid.net/event/backchannel-logout' in events;
    if (!isLogout || 'nonce' in payload) {
      throw new Error(
        'Không phải logout_token hợp lệ (thiếu events backchannel-logout hoặc có nonce)',
      );
    }
    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new Error('logout_token thiếu claim `sub`');
    }
    // jose chỉ kiểm hết hạn khi có `exp`; thiếu thì token replay được vô thời hạn
    if (!payload.exp) {
      throw new Error('logout_token thiếu claim `exp`');
    }
    return { sub: payload.sub };
  }

  // department "" ("Chưa xếp nhóm") và team null đều thành undefined → lưu NULL
  private toLabel(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    // NUL làm Postgres từ chối text (22021), đăng nhập sẽ 500
    const clean = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
    return Array.from(clean).slice(0, TEAM_MAX).join('').trim() || undefined;
  }

  private toClaims(payload: JWTPayload): PmhIdClaims {
    return {
      sub: payload.sub as string,
      email: payload.email as string | undefined,
      employee_code: payload.employee_code as string | undefined,
      full_name: payload.full_name as string | undefined,
      department: this.toLabel(payload.department),
      team: this.toLabel(payload.team),
      app_role: toAppRole(payload.app_role),
      ver: PMH_ID_CLAIMS_VERSION,
    };
  }
}
