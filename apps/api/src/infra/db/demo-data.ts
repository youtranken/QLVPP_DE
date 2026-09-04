/**
 * Dữ liệu DEMO (SDD §11): người dùng và đơn mẫu để màn quản trị, tổng hợp và
 * biểu đồ có gì để xem ngay khi dựng stack.
 *
 * Tách khỏi `seed-data.ts` vì đây là dữ liệu **giả lập cho demo**, còn danh mục
 * và phòng ban là dữ liệu nghiệp vụ thật sẽ dùng cả khi lên prod.
 */

/** Khớp đúng user của mock-idp (SSO-INTEGRATION §9) để đăng nhập ra cùng một người. */
export interface DemoUser {
  pmhSub: string;
  email: string;
  name: string;
  employeeCode: string;
  groups: string[];
}

export const DEMO_USERS: DemoUser[] = [
  {
    pmhSub: 'usr_admin',
    email: 'admin@pmh.com.vn',
    name: 'Quản trị VPP',
    employeeCode: 'NV000',
    groups: ['VPP-Admin', 'Hành chính'],
  },
  {
    pmhSub: 'usr_an',
    email: 'an@pmh.com.vn',
    name: 'Nguyễn Văn An',
    employeeCode: 'NV001',
    groups: ['Kinh doanh'],
  },
  {
    pmhSub: 'usr_binh',
    email: 'binh@pmh.com.vn',
    name: 'Trần Thị Bình',
    employeeCode: 'NV002',
    groups: ['Kế toán'],
  },
  {
    pmhSub: 'usr_chi',
    email: 'chi@pmh.com.vn',
    name: 'Lê Văn Chí',
    employeeCode: 'NV003',
    groups: ['Kỹ thuật'],
  },
  {
    pmhSub: 'usr_dung',
    email: 'dung@pmh.com.vn',
    name: 'Phạm Thị Dung',
    employeeCode: 'NV004',
    groups: ['Nhân sự'],
  },
  {
    pmhSub: 'usr_em',
    email: 'em@pmh.com.vn',
    name: 'Hoàng Văn Em',
    employeeCode: 'NV005',
    groups: ['Kinh doanh'],
  },
];

export interface DemoLine {
  /** Tên món phải khớp danh mục trong `seed-data.ts`; dòng "Khác" thì đặt `custom: true`. */
  item: string;
  quantity: number;
  custom?: boolean;
  unit?: string;
}

export interface DemoRequest {
  user: string;
  /** Lùi bao nhiêu kỳ so với kỳ hiện tại: 0 = kỳ này, 1 = kỳ trước… */
  periodOffset: number;
  status: 'submitted' | 'approved' | 'rejected' | 'delivered';
  /** Số dòng đầu tiên đã giao — để có đơn "đã giao một phần" như SDD §11 yêu cầu. */
  deliveredLines?: number;
  rejectReason?: string;
  note?: string;
  lines: DemoLine[];
}

/**
 * Trải đủ các trạng thái và nhiều kỳ để:
 * - màn Duyệt đơn có việc để làm (đơn `submitted`),
 * - màn Tổng hợp có số đã giao khác số đăng ký (đơn giao một phần),
 * - biểu đồ nhiều kỳ có ít nhất 3 cột.
 */
export const DEMO_REQUESTS: DemoRequest[] = [
  // ── Kỳ hiện tại: có việc cần xử lý ──────────────────────────────────────
  {
    user: 'usr_an',
    periodOffset: 0,
    status: 'submitted',
    note: 'Cần gấp cho dự án mới',
    lines: [
      { item: 'Bút bi Thiên Long 027', quantity: 10 },
      { item: 'Sổ lò xo A5', quantity: 3 },
      { item: 'Kẹp bướm 32', quantity: 2 },
    ],
  },
  {
    user: 'usr_binh',
    periodOffset: 0,
    status: 'submitted',
    lines: [
      { item: 'Bút kim jellitto 0.4', quantity: 5 },
      { item: 'Giấy ghi chú 3 x 3 (note stick)', quantity: 4 },
    ],
  },
  {
    user: 'usr_chi',
    periodOffset: 0,
    status: 'approved',
    deliveredLines: 1,
    lines: [
      { item: 'Mực dấu Horse', quantity: 2 },
      { item: 'Băng keo trong 5cm 70ya', quantity: 6 },
      { item: 'Giá đỡ màn hình', quantity: 1, custom: true, unit: 'cái' },
    ],
  },
  {
    user: 'usr_dung',
    periodOffset: 0,
    status: 'rejected',
    rejectReason: 'Số lượng bút vượt nhu cầu thực tế, vui lòng gửi lại với số ít hơn.',
    lines: [{ item: 'Bút dạ quang Thiên Long', quantity: 20 }],
  },

  // ── Kỳ trước: đã xử lý xong, cho biểu đồ có dữ liệu lịch sử ─────────────
  {
    user: 'usr_an',
    periodOffset: 1,
    status: 'delivered',
    lines: [
      { item: 'Bút bi Thiên Long 027', quantity: 8 },
      { item: 'Tập 100 trang', quantity: 2 },
    ],
  },
  {
    user: 'usr_em',
    periodOffset: 1,
    status: 'delivered',
    lines: [
      { item: 'Bìa còng 5 cm 2 mặt', quantity: 5 },
      { item: 'Kim bấm 10 plus', quantity: 3 },
    ],
  },
  {
    user: 'usr_binh',
    periodOffset: 2,
    status: 'delivered',
    lines: [
      { item: 'Sổ lò xo A5', quantity: 4 },
      { item: 'Bút chì cây', quantity: 6 },
    ],
  },
  {
    user: 'usr_chi',
    periodOffset: 2,
    status: 'delivered',
    lines: [{ item: 'Máy bấm kim 10 plus', quantity: 1 }],
  },
];
