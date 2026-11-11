import { useLayoutEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { useShellFont } from './use-shell-font';

afterEach(() => {
  delete document.body.dataset.shell;
});

describe('useShellFont', () => {
  it('đặt data-shell lên body trước lần vẽ đầu (cùng pha layout), không đợi effect sau khi vẽ', () => {
    let seenBeforePaint: string | undefined = 'chưa đọc';
    function Shell() {
      useShellFont('admin');
      return null;
    }
    // Anh em đứng sau chạy layout effect sau Shell nhưng vẫn trước khi trình duyệt vẽ
    function Probe() {
      useLayoutEffect(() => {
        seenBeforePaint = document.body.dataset.shell;
      }, []);
      return null;
    }
    render(
      <>
        <Shell />
        <Probe />
      </>,
    );
    expect(seenBeforePaint).toBe('admin');
  });
});
