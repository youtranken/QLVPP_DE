// Phải khớp host trong PMH_ISSUER_URL; cổng dùng chung với VPP trên cụm EDGE (:8443)
const PORTAL_HOST = 'de-admin.pmh.com.vn';

export function portalUrl(): string {
  const { protocol, port } = window.location;
  return `${protocol}//${PORTAL_HOST}${port ? `:${port}` : ''}/`;
}

// Portal gắn ?sso=1 vì link rel=noreferrer làm document.referrer thường rỗng; referrer chỉ là dự phòng
export function cameFromPortal(): boolean {
  if (new URLSearchParams(window.location.search).get('sso') === '1') return true;
  try {
    return new URL(document.referrer).hostname === PORTAL_HOST;
  } catch {
    return false;
  }
}
