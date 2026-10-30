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
  it('có actions → hiện nút', () => {
    renderWithI18n(<PageHeader crumbs={[]} title="T" actions={<button>Xuất</button>} />);
    expect(screen.getByRole('button', { name: 'Xuất' })).toBeInTheDocument();
  });
  it('không actions, không mô tả, không crumbs → không nút, không nav', () => {
    renderWithI18n(<PageHeader crumbs={[]} title="T" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});
