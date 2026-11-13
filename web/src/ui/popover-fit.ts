import { flip, offset, shift, size } from '@floating-ui/react';
import type { Middleware, SizeOptions } from '@floating-ui/react';

export const POP_GAP = 6;
export const POP_EDGE = 8;

type Apply = NonNullable<SizeOptions['apply']>;

// Middleware chung cho mọi popover neo vào một ô (Listbox, lịch khoảng ngày): luôn nằm trọn trong màn.
// flip chỉ chọn phía còn nhiều chỗ — phía đó vẫn có thể thiếu (lịch 430px mà trên ô còn 422px ở 390×800), nên:
// - size: không bao giờ cao quá màn (trừ lề), nơi gọi có thể siết thêm (Listbox theo chỗ còn lại của phía đã chọn);
// - shift cả trục dọc: còn tràn thì đẩy vào màn, chấp nhận đè lên mép ô thay vì mất phần đầu/chân của popover.
// size đứng trước shift để chiều cao đã được siết rồi mới đẩy.
export function popoverFit({ gap = POP_GAP, edge = POP_EDGE, apply }: { gap?: number; edge?: number; apply?: Apply } = {}): Middleware[] {
  return [
    offset(gap),
    flip({ padding: edge }),
    size({
      padding: edge,
      apply(state) {
        const viewport = document.documentElement.clientHeight || window.innerHeight;
        state.elements.floating.style.maxHeight = `${Math.max(0, viewport - edge * 2)}px`;
        apply?.(state);
      },
    }),
    shift({ padding: edge, crossAxis: true }),
  ];
}
