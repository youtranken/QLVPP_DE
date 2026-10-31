import { Icon } from '@/ui/icon';

// Bỏ từ không bắt đầu bằng chữ (vd "(demo)") để không ra "B("
function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter((w) => /^\p{L}/u.test(w));
  if (words.length === 0) return '?';
  return ((words[0][0] ?? '') + (words.length > 1 ? (words[words.length - 1][0] ?? '') : '')).toUpperCase();
}

export function DeliveryAvatar({ name, done = false, large = false }: { name: string; done?: boolean; large?: boolean }) {
  return (
    <span className={large ? 'dv-avatar dv-avatar--lg' : 'dv-avatar'} aria-hidden="true">
      {done ? <Icon name="check" size={18} /> : initialsOf(name)}
    </span>
  );
}
