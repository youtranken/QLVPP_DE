type Row = { request_id: string };

// Duyệt/điều chỉnh xong mà người đang xem không còn khớp bộ lọc: giữ họ trong danh sách của hộp Xem phiếu để hộp không đóng ngang
export function keepViewing<T extends Row>(visible: T[], all: T[], viewing: string | null): T[] {
  if (!viewing || visible.some((r) => r.request_id === viewing)) return visible;
  const kept = all.find((r) => r.request_id === viewing);
  if (!kept) return visible;
  const ids = new Set([...visible.map((r) => r.request_id), viewing]);
  return all.filter((r) => ids.has(r.request_id));
}
