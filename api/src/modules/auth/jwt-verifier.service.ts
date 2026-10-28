import { Injectable } from '@nestjs/common';
import type { JWTPayload, JWTVerifyGetKey } from 'jose';
import type { PmhIdClaims } from '../users/users.service';

export interface VerifiedAccessToken {
  claims: PmhIdClaims;
  expiresAt: Date | null;
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
    return {
      claims: this.toClaims(payload),
      expiresAt: new Date(payload.exp * 1000),
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

  private toClaims(payload: JWTPayload): PmhIdClaims {
    return {
      sub: payload.sub as string,
      email: payload.email as string | undefined,
      employee_code: payload.employee_code as string | undefined,
      full_name: payload.full_name as string | undefined,
      department: payload.department as string | undefined,
      groups: (payload.groups as string[] | undefined) ?? [],
    };
  }
}
