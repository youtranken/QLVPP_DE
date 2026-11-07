import { Injectable } from '@nestjs/common';
import { verifyPassword } from './local-sa.service';
import { parseLocalTestAccounts } from './local-test-accounts-env';
import type { LocalTestAccount } from './local-test-accounts-env';
import { LoginLockout } from './login-lockout';

export interface LocalTestLoginResult {
  result: 'ok' | 'bad' | 'locked';
  account?: LocalTestAccount;
}

// Đọc env một lần lúc khởi tạo; tắt = mọi đăng nhập 'bad' và mọi phiên local-test-* bị coi là hết hạn
@Injectable()
export class LocalTestAccountsService {
  private readonly accounts: LocalTestAccount[] | null = parseLocalTestAccounts(
    process.env,
  );
  private readonly lockout = new LoginLockout();

  get enabled(): boolean {
    return this.accounts !== null;
  }

  attemptLogin(
    username: string,
    password: string,
    ip: string,
  ): LocalTestLoginResult {
    let account: LocalTestAccount | undefined;
    const result = this.lockout.attempt(ip, username, () => {
      account = this.verify(username, password);
      return account !== undefined;
    });
    return result === 'ok' ? { result, account } : { result };
  }

  findBySub(sub: string): LocalTestAccount | null {
    return this.accounts?.find((a) => a.sub === sub) ?? null;
  }

  private verify(
    username: string,
    password: string,
  ): LocalTestAccount | undefined {
    if (!this.accounts) {
      return undefined;
    }
    const match = this.accounts.find((a) => a.username === username);
    // Username lạ vẫn chạy scrypt (hash của tài khoản đầu) — không lộ username qua thời gian phản hồi
    const ok = verifyPassword(
      password,
      (match ?? this.accounts[0]).passwordHash,
    );
    return match && ok ? match : undefined;
  }
}
