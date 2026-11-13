import { Component, Suspense, type ReactNode } from 'react';
import { ChunkLoadError } from '@/lib/chunk-load-error';
import { ChunkError } from '@/ui/load-state';

// Chunk lazy 404 sau khi deploy (index.html cũ) làm React gỡ tới gốc → mời tải lại thay vì trắng màn.
// Chỉ nhận lỗi nạp chunk; lỗi khác ném tiếp lên như trước (không giấu lỗi code dưới câu "vừa cập nhật").
export class ChunkErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (error === null) return this.props.children;
    if (error instanceof ChunkLoadError) return this.props.fallback;
    throw error;
  }
}

// Vùng vẽ một route lười: khung chờ của chính màn đó (không nhảy bố cục), nạp hỏng → nút Tải lại trang.
// frame: khung bọc câu báo (nhân viên: panel sáng, chữ không nằm thẳng trên nền teal)
export function RouteChunk({
  loading,
  frame = (n) => n,
  children,
}: {
  loading: ReactNode;
  frame?: (node: ReactNode) => ReactNode;
  children: ReactNode;
}) {
  return (
    <ChunkErrorBoundary fallback={frame(<ChunkError />)}>
      <Suspense fallback={loading}>{children}</Suspense>
    </ChunkErrorBoundary>
  );
}
