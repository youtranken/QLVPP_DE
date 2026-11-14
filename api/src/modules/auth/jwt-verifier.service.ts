import { Injectable } from '@nestjs/common';
import type { JWTPayload, JWTVerifyGetKey } from 'jose';
import { toAppRole } from '../users/users.service';
import type { PmhIdClaims } from '../users/users.service';
import { toLabel } from '../users/profile-label';
import { normalizeLocale, normalizeLocaleUpdatedAt } from './locale';
import { TokenContractError } from './token-contract.error';

export const PMH_ID_CLAIMS_VERSION = 3;

const BCL_EVENT = 'http://schemas.openid.net/event/backchannel-logout';
const LOGOUT_TYP = 'logout+jwt';
export const JTI_MAX = 255;

export interface VerifiedLogoutToken {
  sub: string;
  jti: string;
  sid?: string;
  expiresAt: Date;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

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

  // OIDC Back-Channel Logout 1.0 §2.6: typ logout+jwt, chỉ RS256, `events` đúng dạng, không `nonce`,
  // có `jti` để chống dùng lại, có `iat`/`exp`
  async verifyLogoutToken(logoutToken: string): Promise<VerifiedLogoutToken> {
    const jose = await import('jose');
    const getKey = await this.getKeySource();
    const { payload, protectedHeader } = await jose.jwtVerify(
      logoutToken,
      getKey,
      {
        issuer: process.env.PMH_ISSUER_URL,
        audience: process.env.PMH_CLIENT_ID,
        algorithms: ['RS256'],
        clockTolerance: 60,
      },
    );
    const typ = protectedHeader.typ?.toLowerCase();
    if (typ !== LOGOUT_TYP && typ !== `application/${LOGOUT_TYP}`) {
      throw new Error('logout_token sai typ (phải là logout+jwt)');
    }
    const events = payload.events;
    const event = isPlainObject(events) ? events[BCL_EVENT] : undefined;
    if (!isPlainObject(event)) {
      throw new Error('logout_token thiếu events backchannel-logout');
    }
    if ('nonce' in payload) {
      throw new Error('logout_token có nonce');
    }
    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new Error('logout_token thiếu claim `sub`');
    }
    const { jti, sid } = payload;
    if (typeof jti !== 'string' || jti.length === 0 || jti.length > JTI_MAX) {
      throw new Error('logout_token thiếu hoặc sai claim `jti`');
    }
    if (sid !== undefined && (typeof sid !== 'string' || sid.length === 0)) {
      throw new Error('logout_token sai claim `sid`');
    }
    if (typeof payload.iat !== 'number') {
      throw new Error('logout_token thiếu claim `iat`');
    }
    // jose chỉ kiểm hết hạn khi có `exp`; thiếu thì token replay được vô thời hạn
    if (!payload.exp) {
      throw new Error('logout_token thiếu claim `exp`');
    }
    return {
      sub: payload.sub,
      jti,
      ...(sid === undefined ? {} : { sid }),
      expiresAt: new Date(payload.exp * 1000),
    };
  }

  private toClaims(payload: JWTPayload): PmhIdClaims {
    const localeUpdatedAt = normalizeLocaleUpdatedAt(payload.locale_updated_at);
    return {
      sub: payload.sub as string,
      email: payload.email as string | undefined,
      employee_code: payload.employee_code as string | undefined,
      full_name: payload.full_name as string | undefined,
      department: toLabel(payload.department),
      team: toLabel(payload.team),
      app_role: toAppRole(payload.app_role),
      ver: PMH_ID_CLAIMS_VERSION,
      // docs 7a: có nhưng lạ → vi; thiếu → bỏ trống (/me coi như vi)
      locale:
        payload.locale === undefined || payload.locale === null
          ? undefined
          : normalizeLocale(payload.locale),
      locale_updated_at: localeUpdatedAt ?? undefined,
    };
  }
}
