import type { LostStatus } from '../users/user-access.service';

// params của chuông user_left_with_work (web dựng câu vi/en từ đây, email dựng ở leftWorkMail)
export interface LeftWorkParams {
  name: string;
  reason: LostStatus;
  owed_lines: number;
  owed_months: number;
  pending_lines: number;
  open_request: boolean;
}

const WHY_VI: Record<LostStatus, string> = {
  locked: 'bị khoá',
  deleted: 'bị xoá',
  no_access: 'mất quyền vào VPP',
};
const WHY_EN: Record<LostStatus, string> = {
  locked: 'was locked',
  deleted: 'was deleted',
  no_access: 'lost access to VPP',
};

// Còn nợ → Giao hàng mở sẵn panel người đó (gồm cả kỳ khoá gần nhất lẫn nợ các kỳ trước); chỉ chờ duyệt → Duyệt món
export function leftWorkLink(sub: string, p: LeftWorkParams): string {
  return p.owed_lines > 0
    ? `/admin/delivery?person=${encodeURIComponent(sub)}`
    : '/admin/review';
}

function sentence(p: LeftWorkParams, lang: 'vi' | 'en'): string {
  const parts: string[] = [];
  if (p.owed_lines > 0) {
    parts.push(
      lang === 'vi'
        ? `${p.owed_lines} món chưa nhận (${p.owed_months} tháng)`
        : `${p.owed_lines} undelivered item${p.owed_lines > 1 ? 's' : ''} (${p.owed_months} month${p.owed_months > 1 ? 's' : ''})`,
    );
  }
  if (p.pending_lines > 0) {
    parts.push(
      lang === 'vi'
        ? `${p.pending_lines} món ngoài danh mục chờ duyệt`
        : `${p.pending_lines} off-catalog item${p.pending_lines > 1 ? 's' : ''} awaiting review`,
    );
  }
  const open = p.open_request
    ? lang === 'vi'
      ? ' Có phiếu kỳ đang mở.'
      : ' Has a request in the open period.'
    : '';
  return lang === 'vi'
    ? `${p.name} ${WHY_VI[p.reason]} nhưng còn ${parts.join(', ')}.${open}`
    : `${p.name} ${WHY_EN[p.reason]} but still has ${parts.join(', ')}.${open}`;
}

export function leftWorkMail(
  p: LeftWorkParams,
  link: string,
  baseUrl: string,
): { subject: string; text: string } {
  const url = `${baseUrl.replace(/\/+$/, '')}${link}`;
  return {
    subject: `[VPP] ${p.name} ${WHY_VI[p.reason]} nhưng còn việc dở / ${WHY_EN[p.reason]} with pending work`,
    text: [
      sentence(p, 'vi'),
      `Xem: ${url}`,
      '',
      sentence(p, 'en'),
      `Open: ${url}`,
    ].join('\n'),
  };
}
