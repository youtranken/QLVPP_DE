import { describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { reportStatus } from './report-status';

const t = i18n.t.bind(i18n);
const sent = { state: 'sent' as const, sent: { created_at: '2026-11-08T04:50:00Z' } as never, noOrder: null };

describe('reportStatus', () => {
  it('đã gửi, không đổi → ok, một phần', () => {
    expect(reportStatus(sent, 0, t)).toEqual({ tone: 'ok', parts: ['Đã gửi NCC 11:50 08/11'] });
  });
  it('đã gửi, ranh: 0 món đổi không nói đổi; 1 món đổi → cảnh báo', () => {
    expect(reportStatus(sent, 1, t)).toEqual({ tone: 'warn', parts: ['Đã gửi NCC 11:50 08/11', 'có 1 món đổi sau bản này'] });
  });
  it('chưa gửi: chỉ một phần (món ngoài DM chờ duyệt không ghi ở dòng trạng thái vì chốt sẽ ghi Không mua)', () => {
    expect(reportStatus({ state: 'unsent', sent: null, noOrder: null }, 0, t)).toEqual({ tone: 'warn', parts: ['Chưa gửi NCC'] });
  });
  it('không cần đề nghị', () => {
    expect(reportStatus({ state: 'no_order', sent: null, noOrder: { at: '2026-11-08T04:50:00Z', by: null } }, 0, t).parts).toEqual(['Không cần đề nghị NCC 11:50 08/11']);
  });
});
