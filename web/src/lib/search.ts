export const foldVi = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/gi, 'd').toLowerCase();

export const normalizeSearch = foldVi;

export function matchesSearch(text: string, query: string): boolean {
  return foldVi(text).includes(foldVi(query.trim()));
}

export interface Searchable {
  name: string;
  name_en?: string | null;
  code?: string | null;
}

export function matches(item: Searchable, q: string): boolean {
  const query = q.trim();
  if (!query) return true;
  return [item.name, item.name_en, item.code].some((text) => text != null && matchesSearch(text, query));
}
