import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithI18n, screen, userEvent, within } from '@/test/test-utils';
import { ReorderBar, ReorderCell, ReorderToggle } from '@/ui/reorder';
import { useRowDrag } from '@/ui/use-row-drag';

function Rows({ names, onMove, onMoveTo }: { names: string[]; onMove: (i: number, d: -1 | 1) => void; onMoveTo: (from: number, to: number) => void }) {
  const drag = useRowDrag(onMoveTo);
  return (
    <table>
      <tbody>
        {names.map((n, i) => (
          <tr key={n} data-testid={`row-${n}`} {...drag(i)}>
            <ReorderCell index={i} count={names.length} name={n} onMove={onMove} />
            <td>{n}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

describe('ReorderToggle', () => {
  it('1 dòng → "Sắp xếp" tắt, title nói lý do; 2 dòng → bật, bấm gọi onStart', async () => {
    const onStart = vi.fn();
    const { rerender } = renderWithI18n(<ReorderToggle count={1} onStart={onStart} />);
    expect(screen.getByRole('button', { name: 'Sắp xếp' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sắp xếp' })).toHaveAttribute('title', 'Cần ít nhất 2 dòng để sắp xếp');
    rerender(<ReorderToggle count={2} onStart={onStart} />);
    await userEvent.click(screen.getByRole('button', { name: 'Sắp xếp' }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});

describe('ReorderCell', () => {
  it('một ô: ▲ đứng trên ▼; ▲ dòng đầu và ▼ dòng cuối tắt, dòng giữa bật cả hai', () => {
    renderWithI18n(<Rows names={['cái', 'hộp', 'ram']} onMove={() => {}} onMoveTo={() => {}} />);
    const middle = within(screen.getByTestId('row-hộp'));
    expect(middle.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Đưa hộp lên', 'Đưa hộp xuống']);
    expect(screen.getByRole('button', { name: 'Đưa cái lên' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Đưa cái xuống' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Đưa ram lên' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Đưa ram xuống' })).toBeDisabled();
    expect(middle.getByTitle('Kéo để đổi chỗ')).toBeInTheDocument();
  });

  it('bấm ▼ gọi onMove(index, 1); ▲ gọi onMove(index, -1)', async () => {
    const onMove = vi.fn();
    renderWithI18n(<Rows names={['cái', 'hộp']} onMove={onMove} onMoveTo={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Đưa cái xuống' }));
    await userEvent.click(screen.getByRole('button', { name: 'Đưa hộp lên' }));
    expect(onMove.mock.calls).toEqual([
      [0, 1],
      [1, -1],
    ]);
  });
});

function Live({ initial }: { initial: string[] }) {
  const [names, setNames] = useState(initial);
  const move = (i: number, d: -1 | 1) =>
    setNames((cur) => {
      const next = [...cur];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });
  return <Rows names={names} onMove={move} onMoveTo={() => {}} />;
}

describe('ReorderCell giữ tiêu điểm', () => {
  it('▼ ở dòng giữa → tiêu điểm vẫn ở "Đưa hộp xuống" của dòng vừa dời', async () => {
    renderWithI18n(<Live initial={['cái', 'hộp', 'ram', 'bút']} />);
    await userEvent.click(screen.getByRole('button', { name: 'Đưa hộp xuống' }));
    expect(screen.getByRole('button', { name: 'Đưa hộp xuống' })).toHaveFocus();
  });

  it('▼ tới dòng cuối (▼ tắt) → tiêu điểm sang "Đưa … lên" cùng dòng; ▲ tới dòng đầu → sang "Đưa … xuống"', async () => {
    renderWithI18n(<Live initial={['cái', 'hộp', 'ram']} />);
    await userEvent.click(screen.getByRole('button', { name: 'Đưa hộp xuống' }));
    expect(screen.getByRole('button', { name: 'Đưa hộp xuống' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Đưa hộp lên' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Đưa ram lên' }));
    expect(screen.getByRole('button', { name: 'Đưa ram lên' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Đưa ram xuống' })).toHaveFocus();
  });
});

describe('useRowDrag', () => {
  it('kéo dòng đầu thả lên dòng cuối → onMoveTo(0, 2); thả tại chỗ không gọi', () => {
    const onMoveTo = vi.fn();
    renderWithI18n(<Rows names={['cái', 'hộp', 'ram']} onMove={() => {}} onMoveTo={onMoveTo} />);
    const first = screen.getByTestId('row-cái');
    expect(first).toHaveAttribute('draggable', 'true');
    fireEvent.dragStart(first);
    fireEvent.dragOver(screen.getByTestId('row-ram'));
    fireEvent.drop(screen.getByTestId('row-ram'));
    expect(onMoveTo).toHaveBeenCalledWith(0, 2);
    fireEvent.dragStart(first);
    fireEvent.drop(first);
    expect(onMoveTo).toHaveBeenCalledTimes(1);
  });
});

describe('ReorderBar', () => {
  it('chưa đổi → "Lưu thứ tự" tắt với title "Chưa có thay đổi" và gợi ý kéo/bấm; đã đổi → hiện số đổi, Lưu bật', async () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = renderWithI18n(<ReorderBar dirty={false} dirtyText="Thứ tự đã đổi (2 đơn vị)" saving={false} onCancel={onCancel} onSave={onSave} />);
    expect(screen.getByRole('button', { name: 'Lưu thứ tự' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Lưu thứ tự' })).toHaveAttribute('title', 'Chưa có thay đổi');
    expect(screen.getByText('Kéo ⋮⋮ hoặc bấm ▲▼ để đổi chỗ')).toBeInTheDocument();
    rerender(<ReorderBar dirty dirtyText="Thứ tự đã đổi (2 đơn vị)" saving={false} onCancel={onCancel} onSave={onSave} />);
    expect(screen.getByText('Thứ tự đã đổi (2 đơn vị)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thứ tự' }));
    await userEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('đang lưu → nút ghi "Đang lưu…", cả Hủy và Lưu tắt', () => {
    renderWithI18n(<ReorderBar dirty dirtyText="x" saving onCancel={() => {}} onSave={() => {}} />);
    expect(screen.getByRole('button', { name: 'Đang lưu…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeDisabled();
  });
});
