import type { OtherLine } from './OtherItemsCard';

/** Dòng của đơn cũ (chỉ những trường cần để dựng lại giỏ). */
export interface DongDonCu {
  itemId: string | null;
  name: string;
  unit: string;
  quantity: number;
  attachmentPath: string | null;
}

/** Món trong danh mục hiện tại (chỉ những trường ảnh hưởng tới việc dùng lại). */
export interface MonDanhMuc {
  id: string;
  name: string;
  maxQty: number;
  active: boolean;
  adminOnly: boolean;
}

export interface KetQuaDungLai {
  /** Số lượng theo itemId, đổ thẳng vào state của màn đăng ký. */
  quantities: Record<string, number>;
  otherLines: OtherLine[];
  /** Món không dùng lại được, kèm lý do — PHẢI hiện cho người dùng thấy. */
  boQua: string[];
  /** Món bị hạ số lượng cho vừa giới hạn hiện hành. */
  giamSoLuong: string[];
}

/**
 * Dựng lại giỏ đăng ký từ một đơn cũ.
 *
 * Danh mục thay đổi theo thời gian: món bị ngừng, bị xoá, đổi giới hạn, hoặc
 * chuyển thành chỉ-admin. Chép nguyên xi đơn cũ sẽ tạo ra đơn không gửi được và
 * người dùng không hiểu vì sao. Nên ở đây **lọc trước và nói rõ đã bỏ gì** —
 * thà mất một dòng còn hơn để người dùng bấm Gửi rồi mới thấy lỗi.
 */
export function dungLaiDon(input: {
  lines: DongDonCu[];
  catalog: MonDanhMuc[];
  isAdmin: boolean;
}): KetQuaDungLai {
  const monTheoId = new Map(input.catalog.map((item) => [item.id, item]));
  const quantities: Record<string, number> = {};
  const otherLines: OtherLine[] = [];
  const boQua: string[] = [];
  const giamSoLuong: string[] = [];

  input.lines.forEach((line, index) => {
    // Dòng "Khác" không phụ thuộc danh mục nên luôn dùng lại được.
    if (!line.itemId) {
      otherLines.push({
        key: `cu-${index}`,
        name: line.name,
        unit: line.unit,
        quantity: line.quantity,
        attachmentPath: line.attachmentPath,
      });
      return;
    }

    const mon = monTheoId.get(line.itemId);
    if (!mon) {
      boQua.push(`${line.name} — không còn trong danh mục`);
      return;
    }
    if (!mon.active) {
      boQua.push(`${mon.name} — đã ngừng cung cấp`);
      return;
    }
    if (mon.adminOnly && !input.isAdmin) {
      boQua.push(`${mon.name} — chỉ quản trị viên được đăng ký`);
      return;
    }

    // Cộng dồn phòng khi đơn cũ có hai dòng cùng một món.
    const muon = (quantities[mon.id] ?? 0) + line.quantity;
    if (muon > mon.maxQty) {
      quantities[mon.id] = mon.maxQty;
      giamSoLuong.push(`${mon.name} — giảm còn ${mon.maxQty} (giới hạn hiện tại)`);
    } else {
      quantities[mon.id] = muon;
    }
  });

  return { quantities, otherLines, boQua, giamSoLuong };
}
