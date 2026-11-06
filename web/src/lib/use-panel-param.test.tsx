import { afterEach, describe, expect, it } from 'vitest';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { act, render, screen, userEvent, waitFor } from '@/test/test-utils';
import { usePanelParam } from '@/lib/use-panel-param';

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
