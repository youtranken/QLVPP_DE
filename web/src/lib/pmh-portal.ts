import { fetchJson } from '@/lib/fetch-json';

// Server dựng từ PMH_ISSUER_URL (dev → dev-admin, prod → de-admin) — không để cứng host cổng PMH ID
export type PublicConfig = { admin_contact: string; pmh_portal_url?: string | null };

export const fetchPublicConfig = () => fetchJson<PublicConfig>('/api/public-config');

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// Portal gắn ?sso=1 vì link rel=noreferrer làm document.referrer thường rỗng; referrer chỉ là dự phòng
export async function cameFromPortal(): Promise<boolean> {
  if (new URLSearchParams(window.location.search).get('sso') === '1') return true;
  const refHost = hostOf(document.referrer);
  // Không referrer / cùng host → khỏi hỏi server
  if (!refHost || refHost === window.location.hostname) return false;
  try {
    return refHost === hostOf((await fetchPublicConfig()).pmh_portal_url);
  } catch {
    return false;
  }
}
