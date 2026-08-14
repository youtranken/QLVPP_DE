import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  checkWindowDays,
  DEFAULT_REGISTRATION_WINDOW,
  ErrorCode,
  type RegistrationWindow,
} from '@vpp/shared';
import { eq } from 'drizzle-orm';
import { DB, type Db } from '../../infra/db/db.module';
import { appSettings, users } from '../../infra/db/schema';
import { AuditService, type AuditActor } from '../audit/audit.service';

export interface AppSettingsView extends RegistrationWindow {
  updatedAt: Date | null;
  /** Tên người sửa gần nhất, `null` khi chưa ai sửa (đang dùng mặc định). */
  updatedByName: string | null;
}

/**
 * Cài đặt toàn hệ thống. Hiện chỉ có khung ngày đăng ký, nhưng để riêng một module
 * vì gần như mọi luồng nghiệp vụ đều phải hỏi nó.
 */
@Injectable()
export class SettingsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  /**
   * Khung ngày đăng ký đang áp dụng.
   *
   * Chưa có dòng cài đặt (CSDL mới tinh, hoặc ai đó lỡ xoá) thì trả về mặc định
   * chứ **không** ném lỗi: mất bảng cài đặt mà chặn luôn việc đăng ký thì một sự
   * cố nhỏ thành sự cố lớn.
   */
  async getWindow(): Promise<RegistrationWindow> {
    const [row] = await this.db
      .select({
        startDay: appSettings.regWindowStartDay,
        endDay: appSettings.regWindowEndDay,
      })
      .from(appSettings)
      .limit(1);
    return row ?? DEFAULT_REGISTRATION_WINDOW;
  }

  /** Cài đặt kèm thông tin sửa đổi, cho màn quản trị. */
  async get(): Promise<AppSettingsView> {
    const [row] = await this.db
      .select({
        startDay: appSettings.regWindowStartDay,
        endDay: appSettings.regWindowEndDay,
        updatedAt: appSettings.updatedAt,
        updatedByName: users.name,
      })
      .from(appSettings)
      .leftJoin(users, eq(users.id, appSettings.updatedBy))
      .limit(1);

    return row ?? { ...DEFAULT_REGISTRATION_WINDOW, updatedAt: null, updatedByName: null };
  }

  /** Đổi khung ngày đăng ký (chỉ admin). Ghi audit kèm giá trị CŨ để còn lần lại. */
  async updateWindow(next: RegistrationWindow, actor: AuditActor): Promise<AppSettingsView> {
    const loi = checkWindowDays(next);
    if (loi) throw new BadRequestException({ code: ErrorCode.VALIDATION, message: loi });

    const truoc = await this.getWindow();

    await this.db
      .insert(appSettings)
      .values({
        id: true,
        regWindowStartDay: next.startDay,
        regWindowEndDay: next.endDay,
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .onConflictDoUpdate({
        target: appSettings.id,
        set: {
          regWindowStartDay: next.startDay,
          regWindowEndDay: next.endDay,
          updatedAt: new Date(),
          updatedBy: actor.id,
        },
      });

    await this.audit.log({
      actor,
      action: 'settings.window.update',
      objectType: 'settings',
      detail: { truoc, sau: next },
    });

    return this.get();
  }
}
