import { screen, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { callsTo, itemRow, sendReport, sentData, sentState, YM } from '@/features/send-adm/send-adm-fixtures';

export const PEN = itemRow({ key: 'kA', name: 'Bút bi', requested: 5, need: 5 });
export const PAPER = itemRow({ key: 'kB', name: 'Giấy A4', requested: 3, need: 3 });
export const REPORT = sendReport([PEN, PAPER]);
// 09:02 12/12 giờ VN
export const SENT = sentState(sentData(REPORT, { kA: 5, kB: 3 }));

export function open(path = '/admin/reports') {
  mockViewport(1280);
  renderApp(makeMe('admin'), path);
}
export const table = async () => within((await screen.findAllByRole('table'))[0]!);
export const qtyBox = (name: string) => screen.findByRole('spinbutton', { name: `Đề nghị: ${name}` });

export const snapshotPosts = (f: Parameters<typeof callsTo>[0]) => callsTo(f, 'POST', `/api/admin/reports/${YM}/snapshots`).filter((c) => c.url.endsWith('/snapshots'));

export const statuses = () => within(screen.getByRole('main')).getAllByRole('status');

