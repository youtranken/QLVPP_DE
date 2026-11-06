import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { act, render, screen, userEvent, waitFor } from '@/test/test-utils';
import { useDirtyBackGuard, usePanelParam } from '@/lib/use-panel-param';

const ORDER = Array.from({ length: 12 }, (_, i) => `m${i + 1}`);

function Probe({ known }: { known?: (id: string) => boolean | undefined }) {
  const p = usePanelParam('item', { order: ORDER, known, extra: ['itemCat'] });
  const { search } = useLocation();
  return (
    <>
      <output data-testid="id">{p.id ?? ''}</output>
      <output data-testid="search">{search}</output>
      <output data-testid="pos">{`${p.index}/${p.total} prev=${p.canStep(-1)} next=${p.canStep(1)}`}</output>
      <button type="button" onClick={() => p.open('m1')}>
        open
      </button>
      <button type="button" onClick={() => p.open('new', { itemCat: 'c1' })}>
        add
      </button>
      <button type="button" onClick={() => p.step(1)}>
        down
      </button>
      <button type="button" onClick={() => p.step(-1)}>
        up
      </button>
      <button type="button" onClick={p.close}>
        close
      </button>
    </>
  );
}

function start(url: string, known?: (id: string) => boolean | undefined) {
  window.history.replaceState(null, '', url);
  render(
    <BrowserRouter>
      <Probe known={known} />
    </BrowserRouter>,
  );
}

const text = (id: string) => screen.getByTestId(id).textContent;
const click = (name: string) => userEvent.click(screen.getByRole('button', { name }));

afterEach(() => window.history.replaceState(null, '', '/'));

describe('usePanelParam — lịch sử trình duyệt', () => {
  it('mở = đẩy một mục lịch sử; 10 lần ↓ vẫn một mục; một lần Back đóng panel và gỡ ?item', async () => {
    start('/admin/catalog?q=giay');
    const before = window.history.length;
    await click('open');
    expect(window.history.length).toBe(before + 1);
    expect(text('search')).toBe('?q=giay&item=m1');
    for (let i = 0; i < 10; i += 1) await click('down');
    expect(text('id')).toBe('m11');
    expect(window.history.length).toBe(before + 1);
    await act(async () => window.history.back());
    await waitFor(() => expect(text('id')).toBe(''));
    expect(text('search')).toBe('?q=giay');
  });

  it('đóng sau khi mở bằng đẩy → lùi lại đúng mục trước, không thêm lịch sử', async () => {
    start('/admin/catalog');
    await click('open');
    const opened = window.history.length;
    await click('down');
    await click('close');
    await waitFor(() => expect(text('id')).toBe(''));
    expect(text('search')).toBe('');
    expect(window.history.length).toBe(opened);
  });

  it('F5/dán URL ?item=m3 → mở đúng mục; đóng gỡ tham số bằng replace', async () => {
    start('/admin/catalog?item=m3&q=a');
    const before = window.history.length;
    expect(text('id')).toBe('m3');
    expect(text('pos')).toBe('2/12 prev=true next=true');
    await click('close');
    expect(text('search')).toBe('?q=a');
    expect(window.history.length).toBe(before);
  });

  it('mục đầu: ↑ không được, ↓ được; mục cuối: ↓ không được', () => {
    start('/admin/catalog?item=m1');
    expect(text('pos')).toBe('0/12 prev=false next=true');
  });

  it('mục cuối m12 → ↓ không được, ↑ được', () => {
    start('/admin/catalog?item=m12');
    expect(text('pos')).toBe('11/12 prev=true next=false');
  });

  it('mục không có trong danh sách đang hiện (bị lọc) → vẫn mở, ↑/↓ đều không được', () => {
    start('/admin/catalog?item=x9', () => true);
    expect(text('id')).toBe('x9');
    expect(text('pos')).toBe('-1/12 prev=false next=false');
  });

  it.each(['00000000-0000-4000-8000-000000000000', 'rac'])('?item=%s không tồn tại → không mở, gỡ tham số bằng replace', async (bad) => {
    start(`/admin/catalog?item=${bad}&q=b`, (id) => ORDER.includes(id));
    const before = window.history.length;
    await waitFor(() => expect(text('search')).toBe('?q=b'));
    expect(text('id')).toBe('');
    expect(window.history.length).toBe(before);
  });

  it('dữ liệu chưa tải (known → undefined) → giữ tham số', () => {
    start('/admin/catalog?item=m2', () => undefined);
    expect(text('id')).toBe('m2');
    expect(text('search')).toBe('?item=m2');
  });

  it('tham số đi kèm (itemCat) gỡ cùng khi chuyển mục/đóng', async () => {
    start('/admin/catalog');
    await click('add');
    expect(text('search')).toBe('?item=new&itemCat=c1');
    await click('close');
    await waitFor(() => expect(text('search')).toBe(''));
  });
});

// Panel có chặn Back khi đã sửa; hỏi = promise do test quyết định ("Ở lại" = false, "Bỏ" = true)
function Guarded({ ask }: { ask: () => Promise<boolean> }) {
  useDirtyBackGuard(true, ask);
  return null;
}

function GuardProbe({ ask }: { ask: () => Promise<boolean> }) {
  const p = usePanelParam('item');
  const [guard, setGuard] = useState(false);
  const { search } = useLocation();
  return (
    <>
      <output data-testid="search">{search}</output>
      <output data-testid="id">{p.id ?? ''}</output>
      <button type="button" onClick={() => p.open('m1')}>
        open
      </button>
      <button type="button" onClick={p.close}>
        close
      </button>
      <button type="button" onClick={() => setGuard(true)}>
        guard
      </button>
      {p.id && guard && <Guarded ask={ask} />}
    </>
  );
}

function asker() {
  const answers: ((ok: boolean) => void)[] = [];
  const ask = vi.fn(() => new Promise<boolean>((r) => answers.push(r)));
  return { ask, answer: (ok: boolean) => act(async () => answers.shift()!(ok)) };
}

const settle = () => act(() => new Promise((r) => setTimeout(r, 30)));
const back = () => act(async () => window.history.back());

describe('useDirtyBackGuard — Back hai lần, tự đóng', () => {
  it('Back → hộp hỏi → Back lần nữa → "Ở lại": về đúng mục panel, giữ mục danh sách phía sau (Back sau đó về danh sách, không về trang trước)', async () => {
    window.history.replaceState(null, '', '/admin/home');
    window.history.pushState(null, '', '/admin/catalog?q=a');
    const { ask, answer } = asker();
    render(
      <BrowserRouter>
        <GuardProbe ask={ask} />
      </BrowserRouter>,
    );
    await click('guard');
    await click('open');
    const length = window.history.length;
    await back();
    await waitFor(() => expect(ask).toHaveBeenCalledTimes(1));
    await back();
    await settle();
    expect(window.location.pathname).toBe('/admin/home');
    await answer(false);
    await waitFor(() => expect(window.location.search).toBe('?q=a&item=m1'));
    expect(text('id')).toBe('m1');
    expect(window.history.length).toBe(length);
    await back();
    await waitFor(() => expect(ask).toHaveBeenCalledTimes(2));
    await answer(true);
    await waitFor(() => expect(text('id')).toBe(''));
    expect(window.location.pathname).toBe('/admin/catalog');
    expect(text('search')).toBe('?q=a');
  });

  it('panel không có chặn tự đóng (lùi lịch sử) → panel sau có chặn vẫn hỏi khi bấm Back', async () => {
    window.history.replaceState(null, '', '/admin/catalog');
    const { ask, answer } = asker();
    render(
      <BrowserRouter>
        <GuardProbe ask={ask} />
      </BrowserRouter>,
    );
    await click('open');
    await click('close');
    await waitFor(() => expect(text('id')).toBe(''));
    await settle();
    await click('guard');
    await click('open');
    await back();
    await waitFor(() => expect(ask).toHaveBeenCalledTimes(1));
    expect(text('id')).toBe('m1');
    await answer(true);
    await waitFor(() => expect(text('id')).toBe(''));
  });
});

describe('useDirtyBackGuard — thứ tự trình nghe popstate như Chrome', () => {
  // Chrome gọi trình nghe trên window theo thứ tự đăng ký (capture không đi trước); router đăng ký trước panel.
  // jsdom cho capture đi trước nên giả router bằng capture đăng ký trước để có đúng thứ tự của Chrome
  // và React 19 cập nhật đồng bộ trong popstate: panel bị gỡ ngay trong lượt router, trước khi chặn của panel kịp chạy
  it('router nghe popstate trước và gỡ panel đồng bộ → Back trên panel đã sửa vẫn hỏi, panel còn', async () => {
    window.history.replaceState(null, '', '/admin/catalog');
    window.history.pushState(null, '', '/admin/catalog?item=m1');
    let hide = () => {};
    const routerFirst = () => flushSync(() => hide());
    window.addEventListener('popstate', routerFirst, true);
    function Host({ ask }: { ask: () => Promise<boolean> }) {
      const [shown, setShown] = useState(true);
      hide = () => setShown(false);
      return shown ? <Guarded ask={ask} /> : <output data-testid="gone" />;
    }
    const { ask, answer } = asker();
    try {
      render(<Host ask={ask} />);
      await back();
      await waitFor(() => expect(ask).toHaveBeenCalledTimes(1));
      expect(screen.queryByTestId('gone')).toBeNull();
      await answer(false);
      await waitFor(() => expect(window.location.search).toBe('?item=m1'));
    } finally {
      window.removeEventListener('popstate', routerFirst, true);
    }
  });
});
