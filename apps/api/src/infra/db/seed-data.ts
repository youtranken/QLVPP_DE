/**
 * Danh mục VPP thật của công ty, lấy từ form đăng ký hằng tháng đang dùng
 * ("Monthly Stationery Application" trên Google Forms): 50 món, 6 nhóm + nhóm "Khác".
 * Tách khỏi `seed.ts` để test kiểm chứng được mà không cần chạm DB.
 *
 * Ảnh minh hoạ tải kèm từ form, nằm ở `apps/api/seed-assets/catalog/` và được
 * `seed.ts` chép vào thư mục uploads khi nạp — xem chú thích ở đó.
 *
 * Form chỉ có TÊN món, không có đơn vị tính; `unit` bên dưới là suy ra theo cách
 * mua bán thông thường. Admin sửa lại được ở màn Quản lý danh mục.
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
  /** Tên file ảnh trong `apps/api/seed-assets/catalog/` (không có đuôi). */
  image?: string;
}

export interface SeedCategory {
  name: string;
  /** Nhóm "Khác": người dùng tự nhập tên món + đính ảnh, nên không có món cố định. */
  isOther?: boolean;
  items: SeedItem[];
}

export const SEED_CATALOG: SeedCategory[] = [
  {
    name: 'Băng keo & Keo dán',
    items: [
      { name: 'Băng keo si 3,5cm', unit: 'cuộn', image: 'bang-keo-si-35cm' },
      { name: 'Băng keo trong 5cm 70ya', unit: 'cuộn', image: 'bang-keo-trong-5cm-70ya' },
      { name: 'Băng keo xốp 2.5cm', unit: 'cuộn', image: 'bang-keo-xop-25cm' },
      { name: 'Hồ nước chai nhỏ', unit: 'chai', image: 'ho-nuoc-chai-nho' },
      { name: 'Hồ khô', unit: 'cây', image: 'ho-kho' },
    ],
  },
  {
    name: 'Bìa & File hồ sơ',
    items: [
      { name: 'Bìa nhựa trong A4 (Bìa lá)', unit: 'cái', image: 'bia-nhua-trong-a4' },
      { name: 'Bìa 1 acco nhựa', unit: 'cái', image: 'bia-1-acco-nhua' },
      { name: 'Bìa cây', unit: 'cái', image: 'bia-cay' },
      { name: 'Bìa nhựa lỗ (tốt)', unit: 'xấp', image: 'bia-nhua-lo' },
      { name: 'Bìa nút bấm A4', unit: 'cái', image: 'bia-nut-bam-a4' },
      { name: 'Bìa 20 lá Eagle', unit: 'quyển', image: 'bia-20-la-eagle' },
      { name: 'Bìa trình ký hai mặt', unit: 'cái', image: 'bia-trinh-ky-hai-mat' },
      { name: 'Bìa hai kẹp F4', unit: 'cái', image: 'bia-hai-kep-f4' },
      { name: 'Bìa còng 5 cm 2 mặt', unit: 'cái', image: 'bia-cong-5cm-2-mat' },
    ],
  },
  {
    name: 'Bút & Viết',
    items: [
      { name: 'Bút bảng Thiên Long', unit: 'cây', image: 'but-bang-thien-long' },
      { name: 'Bút bi Thiên Long 027', unit: 'cây', image: 'but-bi-thien-long-027' },
      { name: 'Bút ghi đĩa Thiên Long', unit: 'cây', image: 'but-ghi-dia-thien-long' },
      { name: 'Bút dạ quang Thiên Long', unit: 'cây', image: 'but-da-quang-thien-long' },
      { name: 'Bút kim jellitto 0.4', unit: 'cây', image: 'but-kim-jellitto-04' },
      { name: 'Bút xóa nước CP54', unit: 'cây', image: 'but-xoa-nuoc-cp54' },
      { name: 'Bút xóa kéo Plus', unit: 'cây', image: 'but-xoa-keo-plus' },
      { name: 'Ruột xóa kéo Plus', unit: 'cái', image: 'ruot-xoa-keo-plus' },
      { name: 'Bút chì cây', unit: 'cây', image: 'but-chi-cay' },
      { name: 'Bút chì bấm A255', unit: 'cây', image: 'but-chi-bam-a255' },
      { name: 'Ruột chì', unit: 'hộp', image: 'ruot-chi' },
      { name: 'Chuốt bút chì', unit: 'cái', image: 'chuot-but-chi' },
      { name: 'Chuốt chì quay tay', unit: 'cái', image: 'chuot-chi-quay-tay' },
      { name: 'Gôm Pentel 05', unit: 'cục', image: 'gom-pentel-05' },
    ],
  },
  {
    name: 'Giấy & Sổ',
    items: [
      {
        name: 'Giấy photo A4 trắng 70 Exell',
        unit: 'ram',
        adminOnly: true,
        image: 'giay-photo-a4-trang-70-exell',
      },
      { name: 'Giấy ghi chú 3 x 3 (note stick)', unit: 'tệp', image: 'giay-ghi-chu-3x3' },
      { name: 'Dán Please sign', unit: 'tệp', image: 'dan-please-sign' },
      { name: 'Nhãn dán nhựa 5 màu', unit: 'bộ', image: 'nhan-dan-nhua-5-mau' },
      { name: 'Sổ lò xo A5', unit: 'quyển', image: 'so-lo-xo-a5' },
      { name: 'Tập 100 trang', unit: 'quyển', image: 'tap-100-trang' },
    ],
  },
  {
    name: 'Dụng cụ văn phòng',
    items: [
      { name: 'Kẹp giấy sắt', unit: 'hộp', image: 'kep-giay-sat' },
      { name: 'Kẹp bướm 32', unit: 'hộp', image: 'kep-buom-32' },
      { name: 'Kéo nhỏ', unit: 'cái', image: 'keo-nho' },
      { name: 'Dao dọc giấy', unit: 'cái', image: 'dao-doc-giay' },
      { name: 'Lưỡi dao nhỏ', unit: 'hộp', image: 'luoi-dao-nho' },
      { name: 'Máy bấm kim 10 plus', unit: 'cái', image: 'may-bam-kim-10-plus' },
      { name: 'Kim bấm 10 plus', unit: 'hộp', image: 'kim-bam-10-plus' },
      { name: 'Kiềm Gỡ kim', unit: 'cái', image: 'kiem-go-kim' },
      { name: 'Máy bấm lỗ nhỏ Munix', unit: 'cái', image: 'may-bam-lo-nho-munix' },
      { name: 'Thước kẻ nhựa 3 tấc', unit: 'cây', image: 'thuoc-ke-nhua-3-tac' },
      { name: 'Cục hít trung 30mm', unit: 'cái', image: 'cuc-hit-trung-30mm' },
    ],
  },
  {
    name: 'Thiết bị & Phụ kiện',
    items: [
      { name: 'Máy tính casio 14 số', unit: 'cái', image: 'may-tinh-casio-14-so' },
      { name: 'Mực dấu Horse', unit: 'lọ', image: 'muc-dau-horse' },
      { name: 'Pin AA', unit: 'viên', image: 'pin-aa' },
      { name: 'Kệ mica 3 tầng', unit: 'cái', image: 'ke-mica-3-tang' },
      { name: 'Rổ nhựa', unit: 'cái', image: 'ro-nhua' },
    ],
  },
  {
    name: 'Khác',
    isOther: true,
    items: [],
  },
];

/** Tổng số món cố định trong danh mục. */
export const SEED_ITEM_COUNT = SEED_CATALOG.reduce((sum, group) => sum + group.items.length, 0);
