import { khongDau, MAX_ITEM_QTY } from '@vpp/shared';

/**
 * Đọc file danh mục và đối chiếu với danh mục hiện có.
 *
 * Tách THUẦN khỏi việc đọc đĩa/CSDL: đây là chỗ quyết định "ghi gì vào danh mục
 * thật", nên phải kiểm được đầy đủ mà không cần file lẫn Postgres.
 */

/** Giới hạn trên của `Tối đa` — chặn lỗi gõ thừa số 0 trong file. */
const MAX_TOI_DA = 999;

export type HanhDong = 'them' | 'capNhat' | 'khongDoi' | 'loi';

export interface DongXemTruoc {
  /** Mã món; chuỗi rỗng = để trống (danh mục cho phép không có mã). */
  ma: string;
  /** Số dòng trong file (tính cả dòng tiêu đề) để người dùng còn tìm ra mà sửa. */
  dong: number;
  nhom: string;
  ten: string;
  donVi: string;
  toiDa: number;
  chiAdmin: boolean;
  hanhDong: HanhDong;
  /** Lý do lỗi, hoặc mô tả sẽ đổi gì. Rỗng khi không có gì đáng nói. */
  ghiChu: string;
}

export interface DanhMucHienCo {
  categories: { id: string; name: string }[];
  items: {
    id: string;
    categoryId: string;
    name: string;
    code: string | null;
    unit: string;
    maxQty: number;
    adminOnly: boolean;
    active: boolean;
  }[];
}

export interface KetQuaXemTruoc {
  dong: DongXemTruoc[];
  tomTat: { them: number; capNhat: number; khongDoi: number; loi: number };
  /** Nhóm chưa có, sẽ được tạo khi ghi. */
  nhomMoi: string[];
}

/** Tên cột chấp nhận được, so khớp sau khi bỏ dấu và hạ chữ thường. */
const COT = {
  ma: ['ma', 'ma mon', 'ma vpp', 'ma vat tu', 'code', 'sku'],
  nhom: ['nhom', 'nhom vpp', 'danh muc', 'loai'],
  ten: ['ten mon', 'ten', 'ten vat tu', 'ten vpp', 'mon'],
  donVi: ['don vi tinh', 'dvt', 'don vi'],
  toiDa: ['toi da', 'so luong toi da', 'gioi han', 'max'],
  chiAdmin: ['chi admin', 'admin', 'chi quan tri'],
} as const;

type TenCot = keyof typeof COT;

/** Những cách viết "có" mà người lập file hay dùng. */
const LA_CO = new Set(['x', 'co', 'true', '1', 'yes', 'y', 'v']);
const LA_KHONG = new Set(['', 'khong', 'false', '0', 'no', 'n', '-']);

/** Vị trí từng cột trong file, `undefined` = không có cột đó. */
type ViTriCot = Partial<Record<TenCot, number>>;

function doTieuDe(hang: string[]): ViTriCot {
  const viTri: ViTriCot = {};
  hang.forEach((o, index) => {
    const chuan = khongDau(o ?? '');
    for (const [ten, cachViet] of Object.entries(COT) as [TenCot, readonly string[]][]) {
      if (viTri[ten] === undefined && cachViet.includes(chuan)) viTri[ten] = index;
    }
  });
  return viTri;
}

/**
 * Phân tích lưới ô đọc từ file (kể cả dòng tiêu đề) và đối chiếu danh mục hiện có.
 * Ném lỗi khi thiếu cột bắt buộc — không đoán bừa vị trí cột, vì đoán sai sẽ ghi
 * nhầm hàng loạt vào danh mục thật.
 */
export function xemTruocNhap(luoi: string[][], hienCo: DanhMucHienCo): KetQuaXemTruoc {
  const hangTieuDe = luoi.findIndex((hang) => doTieuDe(hang).ten !== undefined);
  if (hangTieuDe === -1) {
    throw new Error('Không tìm thấy dòng tiêu đề. File phải có cột "Nhóm" và "Tên món".');
  }

  const cot = doTieuDe(luoi[hangTieuDe]);
  const thieu: string[] = [];
  if (cot.nhom === undefined) thieu.push('Nhóm');
  if (cot.ten === undefined) thieu.push('Tên món');
  if (cot.donVi === undefined) thieu.push('Đơn vị tính');
  if (thieu.length > 0) {
    throw new Error(`File thiếu cột bắt buộc: ${thieu.join(', ')}.`);
  }

  const nhomTheoTen = new Map(hienCo.categories.map((c) => [khongDau(c.name), c]));
  // Khoá theo (nhóm, tên) đã bỏ dấu — file gõ thiếu dấu vẫn khớp đúng món cũ,
  // không tạo ra bản sao gần-giống nằm cạnh bản gốc.
  const monTheoKhoa = new Map<string, DanhMucHienCo['items']>();
  for (const item of hienCo.items) {
    const khoa = `${item.categoryId}|${khongDau(item.name)}`;
    const danhSach = monTheoKhoa.get(khoa);
    if (danhSach) danhSach.push(item);
    else monTheoKhoa.set(khoa, [item]);
  }

  // Mã của những món KHÁC đang giữ, để bắt việc gán trùng mã.
  const maDangDung = new Map<string, string>(); // MÃ hoa → id món
  for (const item of hienCo.items) {
    if (item.code) maDangDung.set(item.code.toUpperCase(), item.id);
  }

  // File KHÔNG có cột Mã thì tuyệt đối không đụng tới mã đang có: nếu coi ô trống
  // là "xoá mã", một file cũ nhập vào sẽ thổi bay toàn bộ mã của danh mục.
  const coCotMa = cot.ma !== undefined;

  const ket: DongXemTruoc[] = [];
  const nhomMoi = new Set<string>();
  const daGap = new Map<string, number>();
  const maDaGap = new Map<string, number>();

  for (let i = hangTieuDe + 1; i < luoi.length; i += 1) {
    const hang = luoi[i];
    const soDong = i + 1;
    const o = (index?: number) => (index === undefined ? '' : (hang[index] ?? '').trim());

    const ma = o(cot.ma);
    const nhom = o(cot.nhom);
    const ten = o(cot.ten);
    const donVi = o(cot.donVi);
    const toiDaTho = o(cot.toiDa);
    const chiAdminTho = khongDau(o(cot.chiAdmin));

    // Chỉ bỏ qua dòng TRẮNG HOÀN TOÀN (file Excel hay có dòng thừa ở cuối).
    // Dòng có bất kỳ chữ nào đều phải đi qua kiểm tra: nuốt im lặng một dòng người
    // ta đã gõ dở nghĩa là món đó biến mất mà không ai biết.
    if (!hang.some((o) => (o ?? '').trim())) continue;

    const loi = (ghiChu: string): void => {
      ket.push({
        dong: soDong,
        ma,
        nhom,
        ten,
        donVi,
        toiDa: 0,
        chiAdmin: false,
        hanhDong: 'loi',
        ghiChu,
      });
    };

    if (!nhom) {
      loi('Thiếu tên nhóm');
      continue;
    }
    if (!ten) {
      loi('Thiếu tên món');
      continue;
    }
    if (!donVi) {
      loi('Thiếu đơn vị tính');
      continue;
    }

    let toiDa = MAX_ITEM_QTY;
    if (toiDaTho) {
      const so = Number(toiDaTho);
      if (!Number.isInteger(so) || so < 1 || so > MAX_TOI_DA) {
        loi(`"Tối đa" phải là số nguyên từ 1 đến ${MAX_TOI_DA}`);
        continue;
      }
      toiDa = so;
    }

    let chiAdmin: boolean;
    if (LA_CO.has(chiAdminTho)) chiAdmin = true;
    else if (LA_KHONG.has(chiAdminTho)) chiAdmin = false;
    else {
      loi('Cột "Chỉ admin" chỉ nhận x / có / không (để trống là không)');
      continue;
    }

    if (ma && !/^[A-Za-z0-9._-]{1,30}$/.test(ma)) {
      loi('Mã món tối đa 30 ký tự, chỉ gồm chữ, số và các dấu . _ -');
      continue;
    }

    const khoaFile = `${khongDau(nhom)}|${khongDau(ten)}`;
    const dongTruoc = daGap.get(khoaFile);
    if (dongTruoc !== undefined) {
      loi(`Trùng với dòng ${dongTruoc} trong cùng file`);
      continue;
    }
    daGap.set(khoaFile, soDong);

    // Mã so khớp KHÔNG phân biệt hoa thường, giống ràng buộc ở CSDL — nếu chỉ
    // kiểm y nguyên chữ thì bảng xem trước báo sạch rồi lúc ghi mới vỡ.
    if (ma) {
      const maHoa = ma.toUpperCase();
      const dongTrungMa = maDaGap.get(maHoa);
      if (dongTrungMa !== undefined) {
        loi(`Mã "${ma}" trùng với dòng ${dongTrungMa} trong cùng file`);
        continue;
      }
      maDaGap.set(maHoa, soDong);
    }

    const nhomCu = nhomTheoTen.get(khongDau(nhom));
    const trung = nhomCu ? (monTheoKhoa.get(`${nhomCu.id}|${khongDau(ten)}`) ?? []) : [];
    if (trung.length > 1) {
      loi('Trùng tên với nhiều món đang có — hãy sửa tay trên web trước');
      continue;
    }
    const monCu = trung[0];

    // Mã đang thuộc về một món KHÁC ⇒ chặn. Gán đè sẽ làm hai món cùng mã, mà
    // CSDL cũng không cho, nên thà báo ngay ở bảng xem trước.
    if (ma) {
      const chuSoHuu = maDangDung.get(ma.toUpperCase());
      if (chuSoHuu && chuSoHuu !== monCu?.id) {
        loi(`Mã "${ma}" đang được dùng cho món khác`);
        continue;
      }
    }

    if (!nhomCu) {
      nhomMoi.add(nhom);
      ket.push({
        dong: soDong,
        ma,
        nhom,
        ten,
        donVi,
        toiDa,
        chiAdmin,
        hanhDong: 'them',
        ghiChu: 'Tạo nhóm mới',
      });
      continue;
    }

    if (!monCu) {
      ket.push({
        dong: soDong,
        ma,
        nhom,
        ten,
        donVi,
        toiDa,
        chiAdmin,
        hanhDong: 'them',
        ghiChu: '',
      });
      continue;
    }

    const doi: string[] = [];
    if (coCotMa && (monCu.code ?? '') !== ma) {
      doi.push(ma ? `mã ${monCu.code ?? '(trống)'} → ${ma}` : 'gỡ mã');
    }
    if (monCu.unit !== donVi) doi.push(`đơn vị ${monCu.unit} → ${donVi}`);
    if (monCu.maxQty !== toiDa) doi.push(`tối đa ${monCu.maxQty} → ${toiDa}`);
    if (monCu.adminOnly !== chiAdmin) doi.push(chiAdmin ? 'thành chỉ-admin' : 'bỏ chỉ-admin');
    // Món đã ngừng mà file vẫn liệt kê ⇒ bật lại. Ghi rõ ra vì đây là thay đổi
    // người ta không nghĩ tới khi chỉ định "nhập danh mục".
    if (!monCu.active) doi.push('bật lại món đã ngừng');

    ket.push({
      dong: soDong,
      // File không có cột Mã ⇒ trả lại mã ĐANG CÓ, để bước ghi không hiểu nhầm
      // là phải xoá mã đi.
      ma: coCotMa ? ma : (monCu.code ?? ''),
      nhom,
      ten,
      donVi,
      toiDa,
      chiAdmin,
      hanhDong: doi.length > 0 ? 'capNhat' : 'khongDoi',
      ghiChu: doi.join('; '),
    });
  }

  return {
    dong: ket,
    nhomMoi: [...nhomMoi],
    tomTat: {
      them: ket.filter((d) => d.hanhDong === 'them').length,
      capNhat: ket.filter((d) => d.hanhDong === 'capNhat').length,
      khongDoi: ket.filter((d) => d.hanhDong === 'khongDoi').length,
      loi: ket.filter((d) => d.hanhDong === 'loi').length,
    },
  };
}
