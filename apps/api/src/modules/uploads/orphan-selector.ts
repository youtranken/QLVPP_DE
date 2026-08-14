/**
 * Chọn ảnh mồ côi để xoá — tách thành hàm THUẦN để kiểm thử được mà không cần
 * đĩa hay CSDL. Đây là chỗ dễ gây mất dữ liệu nhất nên phải test kỹ.
 */

export interface StoredFile {
  /** Tên file trên đĩa, vd `9bba19f2-….png`. */
  name: string;
  /** Thời điểm file được ghi (ms). */
  modifiedAt: number;
}

export interface OrphanSelection {
  /** Tên file nên xoá. */
  remove: string[];
  /** File chưa tham chiếu nhưng còn trong thời gian ân hạn — để yên. */
  keptInGrace: number;
}

/** Chỉ đụng file đúng khuôn server sinh; mọi thứ khác (vd `.gitkeep`) để nguyên. */
const SERVER_GENERATED = /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/;

/**
 * File được coi là **mồ côi** khi không còn bản ghi nào trỏ tới, VÀ đã quá thời
 * gian ân hạn.
 *
 * Ân hạn là điểm mấu chốt: người dùng tải ảnh lên xong mới điền nốt form rồi mới
 * gửi. Trong khoảng đó ảnh chưa được bản ghi nào tham chiếu nhưng KHÔNG phải rác —
 * xoá là làm hỏng việc họ đang làm dở.
 */
export function selectOrphans(input: {
  files: StoredFile[];
  /** Đường dẫn đang được tham chiếu, dạng `/api/uploads/<tên file>`. */
  referencedPaths: Iterable<string>;
  now: number;
  graceMs: number;
}): OrphanSelection {
  const referencedNames = new Set<string>();
  for (const path of input.referencedPaths) {
    if (!path) continue;
    // Chỉ lấy phần tên file để so khớp, không phụ thuộc tiền tố đường dẫn.
    referencedNames.add(path.slice(path.lastIndexOf('/') + 1));
  }

  const remove: string[] = [];
  let keptInGrace = 0;

  for (const file of input.files) {
    if (!SERVER_GENERATED.test(file.name)) continue;
    if (referencedNames.has(file.name)) continue;

    if (input.now - file.modifiedAt < input.graceMs) keptInGrace += 1;
    else remove.push(file.name);
  }

  return { remove, keptInGrace };
}
