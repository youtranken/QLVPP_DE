// Điều hướng rời SPA (sang /api/auth/*) gom một chỗ để test thay được
export function navigateTo(url: string): void {
  window.location.assign(url);
}

// POST điều hướng cả trang (server trả 303): dùng khi không được để JS thấy đích chuyển hướng
export function submitForm(action: string, fields: Record<string, string>): void {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  form.hidden = true;
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.append(input);
  }
  document.body.append(form);
  form.submit();
}
