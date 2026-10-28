import { Component, type ReactNode } from 'react';

// Chunk lazy 404 sau khi deploy (index.html cũ) làm React gỡ tới gốc → mời tải lại thay vì trắng màn
export class ChunkErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
