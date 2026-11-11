type T = (key: string, opts?: Record<string, unknown>) => string;

// Hộp hỏi lại chỉ nêu tên vài món đầu, phần còn lại gộp "(và k món nữa)" để hộp không dài theo danh sách
export const MAX_PENDING_NAMES = 5;

export function pendingNames(names: string[], total = names.length): { shown: string[]; more: number } {
  const shown = names.slice(0, MAX_PENDING_NAMES);
  return { shown, more: Math.max(0, total - shown.length) };
}

export function pendingNamesText(names: string[], t: T): string {
  const { shown, more } = pendingNames(names);
  return shown.join(', ') + (more > 0 ? ` ${t('warn.W8more', { k: more })}` : '');
}
