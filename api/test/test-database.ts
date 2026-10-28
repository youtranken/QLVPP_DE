// db-spec reset cả schema; chỉ cho chạy trên DB tên *_test để không xóa nhầm dev/prod cùng credential.
export function assertTestDatabase(url: string | undefined): string {
  if (!url) {
    throw new Error('Thiếu DATABASE_URL cho db-spec (cần DB tên *_test).');
  }
  const name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  if (!name.endsWith('_test')) {
    throw new Error(
      `Từ chối chạy db-spec trên database "${name}": tên phải kết thúc bằng _test.`,
    );
  }
  return url;
}
