import type { Ref } from 'react';
import { createPortal } from 'react-dom';
import type { SnapshotData } from './reports.api';
import { PrintRequestForm } from './print-request-form';
import './print.m1.css';

// Ngoài cây shell: lúc in chỉ vùng này hiện, mọi con khác của body (shell, hộp thoại, toast) ẩn
export function PrintPortal({ snap, ref }: { snap: SnapshotData | null; ref?: Ref<HTMLDivElement> }) {
  if (!snap) return null;
  return createPortal(
    <div ref={ref} className="pp-portal" data-print-portal="">
      <PrintRequestForm snap={snap} />
    </div>,
    document.body,
  );
}
