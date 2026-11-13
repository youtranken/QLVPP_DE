import { Component, Suspense, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ChunkLoadError, renewFailedChunks } from '@/lib/chunk-load-error';
import { ChunkError } from '@/ui/load-state';

// Chunk lazy 404 sau khi deploy (index.html cũ) làm React gỡ tới gốc → mời tải lại thay vì trắng màn.
// Chỉ nhận lỗi nạp chunk; lỗi khác ném tiếp lên như trước (không giấu lỗi code dưới câu "vừa cập nhật").
// resetKey đổi (chuyển trang): bỏ lỗi cũ — boundary nằm trong khung sống lâu (Admin/Nhân viên), không reset thì một lần
// nạp hỏng chặn mọi trang sau đó.
type Props = { children: ReactNode; fallback: ReactNode; resetKey?: unknown };
type State = { error: unknown; resetKey: unknown };

export class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (Object.is(props.resetKey, state.resetKey)) return null;
    if (state.error !== null) renewFailedChunks();
    return { error: null, resetKey: props.resetKey };
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
  const { pathname } = useLocation();
  return (
    <ChunkErrorBoundary resetKey={pathname} fallback={frame(<ChunkError />)}>
      <Suspense fallback={loading}>{children}</Suspense>
    </ChunkErrorBoundary>
  );
}
