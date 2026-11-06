// Khay rỗng: tab chưa có món nào
export function ReviewNone() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true" focusable={false}>
      <circle cx="48" cy="48" r="48" fill="var(--c-surface-2)" />
      <svg x="24" y="24" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--c-muted)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 13l2.4-6.4A2 2 0 0 1 7.3 5.3h9.4a2 2 0 0 1 1.9 1.3L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <path d="M3 13h5l1 2h6l1-2h5" />
      </svg>
    </svg>
  );
}
