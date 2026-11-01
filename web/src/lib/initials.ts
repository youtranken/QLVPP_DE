// Bỏ từ không bắt đầu bằng chữ (vd "(demo)") để không ra "B("
export function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter((w) => /^\p{L}/u.test(w));
  if (words.length === 0) return '?';
  return ((words[0][0] ?? '') + (words.length > 1 ? (words[words.length - 1][0] ?? '') : '')).toUpperCase();
}
