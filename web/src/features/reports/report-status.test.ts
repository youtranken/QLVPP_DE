import { describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { reportStatus } from './report-status';

const t = i18n.t.bind(i18n);
const sent = { state: 'sent' as const, sent: { created_at: '2026-11-08T04:50:00Z' } as never, noOrder: null };

describe('reportStatus', () => {
  it('đã gửi, không đổi → ok, một phần', () => {
    expect(reportStatus(sent, 0, 0, t)).toEqual({ tone: 'ok', parts: ['Đã gửi ADM 11:50 08/11'] });
  });
  it('đã gửi, ranh: 0 món đổi không nói đổi; 1 món đổi → cảnh báo', () => {
    expect(reportStatus(sent, 1, 0, t)).toEqual({ tone: 'warn', parts: ['Đã gửi ADM 11:50 08/11', 'có 1 món đổi sau bản này'] });
  });
  it('chưa gửi + món ngoài DM chờ duyệt', () => {
    expect(reportStatus({ state: 'unsent', sent: null, noOrder: null }, 0, 2, t)).toEqual({ tone: 'warn', parts: ['Chưa gửi ADM', '2 món ngoài danh mục chờ duyệt'] });
  });
  it('không cần đề nghị', () => {
    expect(reportStatus({ state: 'no_order', sent: null, noOrder: { at: '2026-11-08T04:50:00Z', by: null } }, 0, 0, t).parts).toEqual(['Không cần đề nghị ADM 11:50 08/11']);
  });
});
