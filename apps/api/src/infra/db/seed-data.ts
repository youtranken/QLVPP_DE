/**
 * Dữ liệu mẫu cho demo (SDD §11): 5 phòng ban, 5 nhóm danh mục, 25 món.
 * Tách khỏi `seed.ts` để test kiểm chứng được mà không cần chạm DB.
 */

/** Phòng ban suy ra từ group PMH ID — bảng `departments` chỉ là cache phục vụ lọc/báo cáo. */
export const SEED_DEPARTMENTS = [
  'Hành chính',
  'Nhân sự',
  'Kế toán',
  'Kỹ thuật',
  'Kinh doanh',
] as const;

export interface SeedItem {
  name: string;
  unit: string;
  /** Chỉ admin được đăng ký (giấy A4 — SDD §6). */
  adminOnly?: boolean;
}

export interface SeedCategory {
  name: string;
  /** Nhóm "Khác": người dùng tự nhập tên món + đính ảnh, nên không có món cố định. */
  isOther?: boolean;
  items: SeedItem[];
}

export const SEED_CATALOG: SeedCategory[] = [
  {
    name: 'Bút & Viết',
    items: [
      { name: 'Bút bi xanh', unit: 'cây' },
      { name: 'Bút bi đỏ', unit: 'cây' },
      { name: 'Bút bi đen', unit: 'cây' },
      { name: 'Bút chì 2B', unit: 'cây' },
      { name: 'Bút dạ quang', unit: 'cây' },
      { name: 'Bút lông bảng', unit: 'cây' },
      { name: 'Ruột bút bi', unit: 'cái' },
    ],
  },
  {
    name: 'Giấy & Sổ',
    items: [
      { name: 'Giấy A4 (ram 500 tờ)', unit: 'ram', adminOnly: true },
      { name: 'Giấy A5', unit: 'ram' },
      { name: 'Sổ tay A5', unit: 'quyển' },
      { name: 'Sổ lò xo A4', unit: 'quyển' },
      { name: 'Giấy note 3x3', unit: 'tệp' },
      { name: 'Giấy in màu A4', unit: 'ram' },
    ],
  },
  {
    name: 'Mực & Toner',
    items: [
      { name: 'Mực in HP 12A', unit: 'hộp' },
      { name: 'Mực in Canon 328', unit: 'hộp' },
      { name: 'Mực dấu xanh', unit: 'lọ' },
      { name: 'Mực dấu đỏ', unit: 'lọ' },
      { name: 'Ruy băng máy in kim', unit: 'cuộn' },
    ],
  },
  {
    name: 'Dụng cụ văn phòng',
    items: [
      { name: 'Kẹp giấy đen 25mm', unit: 'hộp' },
      { name: 'Ghim bấm số 10', unit: 'hộp' },
      { name: 'Máy bấm ghim', unit: 'cái' },
      { name: 'Kéo văn phòng', unit: 'cái' },
      { name: 'Băng keo trong', unit: 'cuộn' },
      { name: 'Bìa còng A4', unit: 'cái' },
      { name: 'Bìa lá A4', unit: 'cái' },
    ],
  },
  {
    name: 'Khác',
    isOther: true,
    items: [],
  },
];

/** Tổng số món cố định trong danh mục mẫu. */
export const SEED_ITEM_COUNT = SEED_CATALOG.reduce((sum, group) => sum + group.items.length, 0);
