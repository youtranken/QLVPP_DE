/** Mã lỗi nghiệp vụ (BE trả { code, message }; FE hiển thị message). */
export enum ErrorCode {
  REGISTRATION_CLOSED = 'REGISTRATION_CLOSED', // ngoài cửa sổ ngày 1–10
  ITEM_ADMIN_ONLY = 'ITEM_ADMIN_ONLY', // món chỉ admin đăng ký (vd giấy A4)
  ITEM_INACTIVE = 'ITEM_INACTIVE', // món đã ngừng
  QTY_INVALID = 'QTY_INVALID', // số lượng ≤ 0 hoặc vượt maxQty
  EMPTY_REQUEST = 'EMPTY_REQUEST', // đơn không có dòng nào
  DUPLICATE_REQUEST = 'DUPLICATE_REQUEST', // đã có đơn hiệu lực trong kỳ
  CATEGORY_NOT_EMPTY = 'CATEGORY_NOT_EMPTY', // xoá nhóm khi vẫn còn món bên trong
  DUPLICATE_NAME = 'DUPLICATE_NAME', // trùng tên nhóm, hoặc trùng tên món trong cùng nhóm
  NOT_FOUND = 'NOT_FOUND',
  FORBIDDEN = 'FORBIDDEN',
  UNAUTHORIZED = 'UNAUTHORIZED',
  VALIDATION = 'VALIDATION',
  INTERNAL = 'INTERNAL',
}
