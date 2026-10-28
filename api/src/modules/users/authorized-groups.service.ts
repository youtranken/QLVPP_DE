import { Inject, Injectable, Logger } from '@nestjs/common';
import { SystemConfigService } from '../config/system-config.service';
import { DIRECTORY_CLIENT } from './directory.client';
import type { DirectoryClientApi } from './directory.client';

// Self-heal có cache TTL: user sai group login lặp không ép gọi M2M mỗi lần; PMH ID lỗi → dùng bản đã lưu.
@Injectable()
export class AuthorizedGroupsService {
  private readonly logger = new Logger(AuthorizedGroupsService.name);
  private cached: { groups: string[]; expires: number } | null = null;
  private static readonly TTL_MS = 30_000;

  constructor(
    @Inject(DIRECTORY_CLIENT) private readonly directory: DirectoryClientApi,
    private readonly config: SystemConfigService,
  ) {}

  current(): Promise<string[]> {
    return this.config.getAuthorizedGroups();
  }

  async refreshForLogin(): Promise<string[]> {
    if (this.cached && this.cached.expires > Date.now()) {
      return this.cached.groups;
    }
    try {
      // Lọc group thiếu `name` — một phần tử hỏng không được giết cả self-heal
      const names = (await this.directory.fetchGroups())
        .map((g) => g.name)
        .filter((n): n is string => typeof n === 'string' && n.length > 0);
      if (names.length === 0) {
        // Rỗng = không có tín hiệu; ghi đè [] sẽ tắt gate toàn cục
        this.logger.warn(
          'self-heal fetchGroups trả rỗng — giữ authorized_groups cũ, KHÔNG ghi đè (tránh tắt gate)',
        );
        const fallback = await this.config.getAuthorizedGroups();
        this.setCache(fallback);
        return fallback;
      }
      await this.config.setAuthorizedGroups(names);
      this.setCache(names);
      return names;
    } catch (error) {
      this.logger.warn(
        `self-heal fetchGroups lỗi (dùng bản đã lưu): ${(error as Error).message}`,
      );
      const fallback = await this.config.getAuthorizedGroups();
      // Cache cả khi lỗi để không dội PMH ID lúc đang sập
      this.setCache(fallback);
      return fallback;
    }
  }

  clearCache(): void {
    this.cached = null;
  }

  private setCache(groups: string[]): void {
    this.cached = {
      groups,
      expires: Date.now() + AuthorizedGroupsService.TTL_MS,
    };
  }
}
