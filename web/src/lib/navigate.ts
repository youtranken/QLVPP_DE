// Điều hướng rời SPA (sang /api/auth/*) gom một chỗ để test thay được
export function navigateTo(url: string): void {
  window.location.assign(url);
}
