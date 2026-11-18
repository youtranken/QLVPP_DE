import type { ReactNode } from 'react';

// Ô Người dùng chung cho bảng kỳ đang giao và kỳ đang đăng ký: tên, nhãn cùng dòng, dòng phụ phòng · tổ · lưu
export function MonthPersonText({ name, sub, children }: { name: string; sub: string; children?: ReactNode }) {
  return (
    <span className="mk-person__text">
      <span className="sm-person__name">{name}</span>
      {children}
      <small className="mk-person__sub">{sub}</small>
    </span>
  );
}
