import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import i18n from '@/lib/i18n';
import { itemRow, sendReport, setupSendAdm } from '@/features/send-adm/send-adm-fixtures';

const REPORT = sendReport([
  itemRow({ key: 'item-pen', name: 'Bút bi xanh', name_en: 'Blue pen', requested: 5, need: 5 }),
  itemRow({ key: 'item-glue', name: 'Hồ dán', name_en: null, requested: 2, need: 2 }),
  itemRow({ key: 'item-clip', name: 'Kẹp giấy', name_en: '', requested: 1, need: 1 }),
]);

async function openIn(lang: 'vi' | 'en') {
  await i18n.changeLanguage(lang);
  setupSendAdm({ report: REPORT });
  mockViewport(1280);
  renderApp(makeMe('admin'), '/admin/reports');
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await i18n.changeLanguage('vi');
});

describe('Tên món theo ngôn ngữ giao diện (name_en khi en và khác rỗng, không thì name)', () => {
  it('en: bảng "Blue pen"; name_en null/"" → giữ tên Việt', async () => {
    await openIn('en');
    const table = within((await screen.findAllByRole('table'))[0]!);
    expect(await table.findByRole('row', { name: /Blue pen/ })).toBeInTheDocument();
    expect(table.queryByText('Bút bi xanh')).toBeNull();
    expect(table.getByRole('row', { name: /Hồ dán/ })).toBeInTheDocument();
    expect(table.getByRole('row', { name: /Kẹp giấy/ })).toBeInTheDocument();
  });

  it('vi: tên Việt dù có name_en', async () => {
    await openIn('vi');
    const table = within((await screen.findAllByRole('table'))[0]!);
    expect(await table.findByRole('row', { name: /Bút bi xanh/ })).toBeInTheDocument();
    expect(table.queryByText('Blue pen')).toBeNull();
  });

  it('cột 3 cùng tên ở Gửi NCC cũ: vi "Đăng ký", en "Requested"', async () => {
    await openIn('vi');
    const vi = within((await screen.findAllByRole('table'))[0]!);
    await vi.findByRole('row', { name: /Bút bi xanh/ });
    expect(vi.getAllByRole('columnheader')[2]).toHaveTextContent('Đăng ký');
    await i18n.changeLanguage('en');
    const en = within((await screen.findAllByRole('table'))[0]!);
    expect(await en.findByRole('columnheader', { name: /Requested/ })).toBeInTheDocument();
  });
});
