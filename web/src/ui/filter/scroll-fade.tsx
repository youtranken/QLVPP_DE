import type { HTMLAttributes } from 'react';
import { useScrollFade } from './use-scroll-fade';

// Khung cuộn ngang có mờ mép khi còn nội dung khuất (xem use-scroll-fade.ts)
export function ScrollFade({ children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  const ref = useScrollFade<HTMLDivElement>();
  return (
    <div ref={ref} {...rest}>
      {children}
    </div>
  );
}
