/**
 * Bỏ dấu tiếng Việt và hạ chữ thường — dùng để SO KHỚP, không dùng để hiển thị.
 *
 * Người dùng gõ "but bi" phải tìm ra "Bút bi", và tiêu đề cột "Đơn vị tính" trong
 * file nhập phải khớp dù người lập file gõ "Don vi tinh". `đ` không có dấu tổ hợp
 * nên `normalize` không tách ra được, phải thay tay.
 */
export function khongDau(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim()
    .toLowerCase();
}
