import { describe, it, expect } from 'vitest';
import { PageHeader } from '@/ui/page-header';
import { renderWithI18n, screen, within } from '@/test/test-utils';

describe('PageHeader', () => {
  it('breadcrumb là nav "Vị trí", h1 là tiêu đề, mô tả hiện', () => {
    renderWithI18n(<PageHeader crumbs={['Vận hành', 'Tổng hợp']} title="Tổng hợp kỳ" description="Số liệu tháng" />);
    const nav = screen.getByRole('navigation', { name: 'Vị trí' });
    expect(within(nav).getByText('Vận hành')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Tổng hợp kỳ' })).toBeInTheDocument();
    expect(screen.getByText('Số liệu tháng')).toBeInTheDocument();
  });
  it('nút phụ đứng trước, nút chính đứng cuối (bên phải) trong cùng nhóm thao tác', () => {
    renderWithI18n(<PageHeader crumbs={[]} title="T" primary={<button>Thêm món</button>} secondary={<button>Nhóm món</button>} />);
    const group = screen.getByRole('group', { name: 'Thao tác trang' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['Nhóm món', 'Thêm món']);
  });
  it('chỉ nút chính → nhóm thao tác có đúng một nút', () => {
    renderWithI18n(<PageHeader crumbs={[]} title="T" primary={<button>Xuất</button>} />);
    expect(within(screen.getByRole('group', { name: 'Thao tác trang' })).getAllByRole('button')).toHaveLength(1);
  });
  it('mô tả một dòng: khi bị cắt vẫn đọc đủ qua title', () => {
    const long = 'Số cần mua trong tháng, xuất Excel và in giấy trình ký cho Hành chính.';
    renderWithI18n(<PageHeader crumbs={[]} title="T" description={long} />);
    expect(screen.getByText(long)).toHaveAttribute('title', long);
  });
  it('không nút, không mô tả, không crumbs → không nhóm thao tác, không nav', () => {
    renderWithI18n(<PageHeader crumbs={[]} title="T" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});
