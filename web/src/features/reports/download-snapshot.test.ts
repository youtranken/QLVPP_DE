import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureDownloads } from './reports-test-stub';
import { downloadSnapshot } from './reports.api';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('downloadSnapshot — thu hồi blob URL', () => {
  it('chưa thu hồi lúc 0 ms và 9 999 ms sau khi bấm tải (Firefox/Safari còn đọc blob); thu hồi đúng URL đó lúc 10 000 ms', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Blob(['xlsx-bytes']), { status: 200 })));
    const downloads = captureDownloads();
    const revoke = vi.fn();
    URL.revokeObjectURL = revoke;
    await downloadSnapshot('snap-1', 'vi', '2026-10');
    expect(downloads.map((d) => d.name)).toEqual(['vpp-bao-cao-2026-10.xlsx']);
    await vi.advanceTimersByTimeAsync(0);
    expect(revoke).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(9_999);
    expect(revoke).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:t/0');
  });
});
