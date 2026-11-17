import { foldVi } from './search';

export type CategoryIcon = 'pen' | 'paper' | 'clip' | 'folder' | 'box';

// Món chưa có ảnh hiện biểu tượng theo tên nhóm; thứ tự quan trọng ("bìa" trước "giấy" không trùng nhau)
const RULES: [CategoryIcon, string[]][] = [
  ['pen', ['but']],
  ['folder', ['luu tru', 'bia', 'ho so']],
  ['paper', ['giay', 'so']],
  ['clip', ['kep', 'ghim', 'dan']],
];

export function categoryIcon(name: string | null | undefined): CategoryIcon {
  const words = ` ${foldVi(name ?? '').replace(/[^a-z0-9]+/g, ' ')} `;
  return RULES.find(([, keys]) => keys.some((k) => words.includes(` ${k} `)))?.[0] ?? 'box';
}
