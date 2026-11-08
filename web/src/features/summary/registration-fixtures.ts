import { jsonResponse } from '@/test/test-utils';
import { lineView } from '@/test/fixtures-request';
import type { RegistrationRow, RegistrationView } from './summary.api';

const row = (over: Partial<RegistrationRow>): RegistrationRow => ({
  request_id: 'q-a',
  user_sub: 'u-a',
  full_name: 'Nhân viên A',
  email: 'a@pmh.com.vn',
  team: 'Team Test',
  line_count: 3,
  total_qty: 22,
  custom_count: 0,
  saved_at: '2026-11-07T04:06:00.000Z',
  ...over,
});

export const REGISTRATIONS: RegistrationRow[] = [
  row({}),
  row({ request_id: 'q-b', user_sub: 'u-b', full_name: 'Nhân viên B', team: null, custom_count: 1, saved_at: '2026-11-07T04:20:00.000Z' }),
  row({ request_id: 'q-c', user_sub: 'u-c', full_name: 'Nhân viên C', saved_at: '2026-11-07T04:31:00.000Z' }),
];

const item = (name: string, active = true) => ({ name, name_en: null, unit: 'cay', pack_note: null, image_file_id: null, active, admin_only: false });

export function registrationView(id: string): RegistrationView {
  const r = REGISTRATIONS.find((x) => x.request_id === id)!;
  return {
    id,
    period_ym: '2026-11',
    user_sub: r.user_sub,
    full_name: r.full_name,
    department: 'Phòng Công trình',
    updated_at: r.saved_at,
    saved_at: r.saved_at,
    is_open: true,
    user_status: 'active',
    team: r.team,
    lines: [
      lineView({ id: `${id}-1`, item_id: 'i-pen', item: item('Bút bi xanh'), qty: 2 }),
      lineView({ id: `${id}-2`, item_id: 'i-old', item: item('Bút ghi đĩa', false), qty: 19 }),
      lineView({ id: `${id}-3`, custom_name: 'Test mon khac', custom_unit: 'cai', qty: 1, review_status: 'pending' }),
      lineView({ id: `${id}-4`, custom_name: 'Món bị từ chối', custom_unit: 'cai', qty: 7, review_status: 'rejected' }),
    ],
  };
}

export function registrationRoute(rows: RegistrationRow[] = REGISTRATIONS) {
  return (url: string): Response | undefined => {
    const m = /^\/api\/admin\/periods\/2026-11\/registrations(?:\/([\w-]+))?$/.exec(url);
    if (!m) return undefined;
    return jsonResponse(200, m[1] ? registrationView(m[1]) : { items: rows });
  };
}
