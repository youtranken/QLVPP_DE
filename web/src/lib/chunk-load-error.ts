// Nạp chunk thất bại (deploy mới xoá file hash cũ, mất mạng): gói lại để ChunkErrorBoundary nhận đúng loại lỗi này
// trên mọi trình duyệt (thông điệp gốc của Chrome/Firefox/Safari mỗi nơi một kiểu)
export class ChunkLoadError extends Error {
  constructor(cause: unknown) {
    super('chunk load failed', { cause });
    this.name = 'ChunkLoadError';
  }
}
