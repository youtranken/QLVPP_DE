import { MAX_ITEM_QTY } from './constants';
import { ErrorCode } from './errors';
import { describeWindow, isRegistrationOpen, type RegistrationWindow } from './period';
import type { RequestStatus, Role } from './types';

/**
 * Quy tắc nghiệp vụ của đơn đăng ký — dùng CHUNG cho backend và frontend.
 * Frontend dùng để khoá nút/hiện cảnh báo sớm; backend vẫn kiểm lại vì
 * **không tin giao diện** (SDD §2).
 */

/** Một dòng đơn cần kiểm. `itemId` null = dòng thuộc mục "Khác" (tên tự nhập). */
export interface RequestLineInput {
  itemId: string | null;
  name: string;
  quantity: number;
}

/** Thông tin món lấy từ danh mục, phục vụ kiểm tra dòng đơn. */
export interface CatalogItemRule {
  id: string;
  adminOnly: boolean;
  maxQty: number;
  active: boolean;
}

export interface RuleViolation {
  code: ErrorCode;
  message: string;
  /** Chỉ số dòng bị lỗi (nếu lỗi thuộc về một dòng cụ thể). */
  lineIndex?: number;
}

/**
 * Cửa sổ đăng ký khoá cứng với NHÂN VIÊN; admin bỏ qua (CORE-6, CORE-16).
 * Kiểm tại THỜI ĐIỂM GỬI, không phải lúc mở form.
 */
export function checkRegistrationWindow(
  role: Role,
  window: RegistrationWindow,
  now: Date = new Date(),
): RuleViolation | null {
  if (role === 'admin' || isRegistrationOpen(window, now)) return null;
  return {
    code: ErrorCode.REGISTRATION_CLOSED,
    message: `Đã hết hạn đăng ký (chỉ nhận ${describeWindow(window)} hằng tháng).`,
  };
}

/**
 * Kiểm toàn bộ dòng của đơn. Trả về DANH SÁCH lỗi để người dùng sửa một lượt,
 * thay vì báo từng lỗi một.
 */
export function checkRequestLines(
  lines: RequestLineInput[],
  role: Role,
  catalog: Map<string, CatalogItemRule>,
): RuleViolation[] {
  if (lines.length === 0) {
    return [{ code: ErrorCode.EMPTY_REQUEST, message: 'Đơn phải có ít nhất một món.' }];
  }

  const violations: RuleViolation[] = [];

  lines.forEach((line, lineIndex) => {
    if (!line.name.trim()) {
      violations.push({
        code: ErrorCode.VALIDATION,
        message: 'Tên món không được để trống.',
        lineIndex,
      });
    }

    // Dòng "Khác" không có món trong danh mục ⇒ áp giới hạn mặc định.
    const item = line.itemId ? catalog.get(line.itemId) : undefined;

    if (line.itemId && !item) {
      violations.push({
        code: ErrorCode.NOT_FOUND,
        message: `Không tìm thấy món "${line.name}" trong danh mục.`,
        lineIndex,
      });
      return;
    }

    if (item && !item.active) {
      violations.push({
        code: ErrorCode.ITEM_INACTIVE,
        message: `Món "${line.name}" đã ngừng cung cấp.`,
        lineIndex,
      });
    }

    // Cấm A4 với nhân viên — kiểm ở SERVER kể cả khi giao diện đã khoá (CORE-4).
    if (item?.adminOnly && role !== 'admin') {
      violations.push({
        code: ErrorCode.ITEM_ADMIN_ONLY,
        message: `Món "${line.name}" chỉ quản trị viên được đăng ký.`,
        lineIndex,
      });
    }

    const maxQty = item?.maxQty ?? MAX_ITEM_QTY;
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > maxQty) {
      violations.push({
        code: ErrorCode.QTY_INVALID,
        message: `Số lượng của "${line.name}" phải là số nguyên từ 1 đến ${maxQty}.`,
        lineIndex,
      });
    }
  });

  return violations;
}

/**
 * Điều kiện huỷ đơn của NHÂN VIÊN (FR-23, CORE-8):
 * đơn còn `submitted` **và** vẫn trong cửa sổ đăng ký.
 */
export function canCancelRequest(
  status: RequestStatus,
  window: RegistrationWindow,
  now: Date = new Date(),
): boolean {
  return status === 'submitted' && isRegistrationOpen(window, now);
}

/** Chỉ đơn đã duyệt (hoặc đang giao dở) mới được xác nhận giao — BR-09, CORE-14. */
export function canDeliverRequest(status: RequestStatus): boolean {
  return status === 'approved' || status === 'delivered';
}

/** Mã đơn hiển thị cho người dùng: `VPP-2026-08-0007`. */
export function formatRequestCode(period: string, sequence: number): string {
  return `VPP-${period}-${String(sequence).padStart(4, '0')}`;
}
