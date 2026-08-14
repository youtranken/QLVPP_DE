import type { RequestStatus, Role } from '@vpp/shared';

/** Hình dạng dữ liệu API trả về — giữ một chỗ để các màn dùng chung. */

export interface Me {
  id: string;
  sub: string;
  email: string | null;
  name: string | null;
  role: Role;
  department: string | null;
  groups: string[];
}

export interface RegistrationStatus {
  period: string;
  open: boolean;
  canRegister: boolean;
  windowStartDay: number;
  windowEndDay: number;
}

export interface CatalogItem {
  id: string;
  categoryId: string;
  name: string;
  unit: string;
  adminOnly: boolean;
  maxQty: number;
  active: boolean;
  sortOrder: number;
  /** Ảnh minh hoạ do admin tải lên; null = chưa có ảnh. */
  imagePath: string | null;
}

export interface CatalogCategory {
  id: string;
  name: string;
  isOther: boolean;
  sortOrder: number;
  items: CatalogItem[];
}

export interface RequestLine {
  id: string;
  requestId: string;
  itemId: string | null;
  name: string;
  unit: string;
  quantity: number;
  delivered: boolean;
  deliveredQty: number;
  attachmentPath: string | null;
  note: string | null;
}

export interface VppRequest {
  id: string;
  code: string;
  userId: string;
  departmentId: string | null;
  period: string;
  status: RequestStatus;
  note: string | null;
  rejectReason: string | null;
  approvedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: RequestLine[];
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  requestId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationList {
  items: Notification[];
  unread: number;
  page: number;
  pageSize: number;
}
