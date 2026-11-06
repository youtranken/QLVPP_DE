import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import i18n from '@/lib/i18n';
import { ISSUE, reportFixture } from './reports-fixtures';
import { stubReports } from './reports-test-stub';

const REPORT = reportFixture({
  byItem: [
    ...reportFixture().byItem,
    { key: 'item-clip', item_id: 'item-clip', name: 'Kẹp giấy', name_en: '', unit: 'hop', requested: 1, backlog_prev: 0, stock: 0, need: 1 },
  ],
  issues: [ISSUE, { ...ISSUE, item_name: 'Ghim bấm', item_name_en: null, reason: 'Thiếu ghim' }, { ...ISSUE, item_name: 'Bìa còng', item_name_en: '', reason: 'Lưu hồ sơ' }],
});

async function openIn(lang: 'vi' | 'en') {
  await i18n.changeLanguage(lang);
  stubReports({ reports: { '2026-10': REPORT } });
  mockViewport(1280);
  renderApp(makeMe('admin'), '/admin/reports');
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await i18n.changeLanguage('vi');
});

describe('Tên món theo ngôn ngữ giao diện (name_en khi en và khác rỗng, không thì name)', () => {
  it('en: Phần 1 "Blue pen"; name_en null/"" → giữ tên Việt', async () => {
    await openIn('en');
    const part1 = await screen.findByRole('region', { name: 'Part 1 · Summary by item' });
    expect(await within(part1).findByRole('row', { name: /Blue pen/ })).toBeInTheDocument();
    expect(within(part1).queryByText('Bút bi xanh')).toBeNull();
    expect(within(part1).getByRole('row', { name: /Hồ dán/ })).toBeInTheDocument();
    expect(within(part1).getByRole('row', { name: /Kẹp giấy/ })).toBeInTheDocument();
  });

  it('en: bảng Xuất lẻ "A4 paper"; item_name_en null/"" → tên Việt', async () => {
    await openIn('en');
    const issues = await screen.findByRole('region', { name: 'Ad-hoc issues this period' });
    expect(within(issues).getByText('A4 paper')).toBeInTheDocument();
    expect(within(issues).queryByText('Giấy A4')).toBeNull();
    expect(within(issues).getByText('Ghim bấm')).toBeInTheDocument();
    expect(within(issues).getByText('Bìa còng')).toBeInTheDocument();
  });

  it('en: Phần 2 "Blue pen"; dòng name_en null → tên Việt', async () => {
    await openIn('en');
    const detail = await screen.findByRole('region', { name: 'Part 2 · Detail by department' });
    expect(within(detail).getByRole('row', { name: /Phạm Văn Đức/ })).toHaveTextContent('Blue pen');
    expect(within(detail).getByRole('row', { name: /Võ Thị Lan/ })).toHaveTextContent('Băng keo 2 mặt');
  });

  it('vi: cả ba bảng dùng tên Việt dù có name_en', async () => {
    await openIn('vi');
    const part1 = await screen.findByRole('region', { name: 'Phần 1 · Tổng hợp theo món' });
    expect(await within(part1).findByRole('row', { name: /Bút bi xanh/ })).toBeInTheDocument();
    expect(within(part1).queryByText('Blue pen')).toBeNull();
    const issues = screen.getByRole('region', { name: 'Xuất lẻ trong kỳ' });
    expect(within(issues).getByText('Giấy A4')).toBeInTheDocument();
    expect(within(issues).queryByText('A4 paper')).toBeNull();
    const detail = screen.getByRole('region', { name: 'Phần 2 · Chi tiết theo phòng ban' });
    expect(within(detail).getByRole('row', { name: /Phạm Văn Đức/ })).toHaveTextContent('Bút bi xanh');
  });

  it('cột 3 Phần 1 cùng tên Gửi ADM: vi "Đăng ký", en "Requested"', async () => {
    await openIn('vi');
    const vi = await screen.findByRole('region', { name: 'Phần 1 · Tổng hợp theo món' });
    await within(vi).findByRole('row', { name: /Bút bi xanh/ });
    expect(within(vi).getAllByRole('columnheader')[2]).toHaveTextContent('Đăng ký');
    await i18n.changeLanguage('en');
    const en = await screen.findByRole('region', { name: 'Part 1 · Summary by item' });
    expect(within(en).getAllByRole('columnheader')[2]).toHaveTextContent('Requested');
  });
});
