// Ném lỗi kèm status khi !ok để caller phân biệt "lỗi" với "danh sách rỗng"
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) {
    const e = new Error(`HTTP ${r.status}`) as Error & { status?: number };
    e.status = r.status;
    throw e;
  }
  return (await r.json()) as T;
}
