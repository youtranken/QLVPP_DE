import { initialsOf } from '@/lib/initials';
import { Icon } from '@/ui/icon';
import './delivery.m1.css';

export function DeliveryAvatar({ name, done = false, large = false }: { name: string; done?: boolean; large?: boolean }) {
  return (
    <span className={large ? 'dv-avatar dv-avatar--lg' : 'dv-avatar'} aria-hidden="true">
      {done ? <Icon name="check" size={18} /> : initialsOf(name)}
    </span>
  );
}
