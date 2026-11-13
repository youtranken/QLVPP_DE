// Nạp chunk thất bại (deploy mới xoá file hash cũ, mất mạng): gói lại để ChunkErrorBoundary nhận đúng loại lỗi này
// trên mọi trình duyệt (thông điệp gốc của Chrome/Firefox/Safari mỗi nơi một kiểu)
export class ChunkLoadError extends Error {
  constructor(cause: unknown) {
    super('chunk load failed', { cause });
    this.name = 'ChunkLoadError';
  }
}

// React.lazy nhớ mãi lời từ chối: trang nạp hỏng đăng ký cách tạo lazy mới ở đây, ChunkErrorBoundary gọi khi chuyển trang
// (không gọi ngay lúc hỏng — React vẽ lại thử một lần sẽ nạp lại liền, lặp vô tận khi file đã mất sau deploy)
const renewals = new Set<() => void>();

export function renewLater(renew: () => void): void {
  renewals.add(renew);
}

export function renewFailedChunks(): void {
  for (const renew of renewals) renew();
  renewals.clear();
}
