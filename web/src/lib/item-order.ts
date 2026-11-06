export interface ItemOrderKey {
  id: string;
  name: string;
  sort_order: number;
  category: { name: string; sort_order: number } | null;
}

// Postgres COLLATE "C" so byte UTF-8 = so mã điểm; so theo đơn vị UTF-16 sẽ lệch với ký tự ngoài BMP
function byCodePoint(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const d = x[i].codePointAt(0)! - y[i].codePointAt(0)!;
    if (d !== 0) return d;
  }
  return x.length - y.length;
}

function byCategory(a: ItemOrderKey['category'], b: ItemOrderKey['category']): number {
  if (!a || !b) return (a ? 0 : 1) - (b ? 0 : 1);
  return a.sort_order - b.sort_order || byCodePoint(a.name.toLowerCase(), b.name.toLowerCase());
}

// Cùng khóa với ITEM_ORDER của api: c.sort_order NULLS LAST, lower(c.name) COLLATE "C", i.sort_order, lower(i.name) COLLATE "C", i.id
export function compareItems(a: ItemOrderKey, b: ItemOrderKey): number {
  return (
    byCategory(a.category, b.category) ||
    a.sort_order - b.sort_order ||
    byCodePoint(a.name.toLowerCase(), b.name.toLowerCase()) ||
    byCodePoint(a.id, b.id)
  );
}

// category_id không có trong danh sách nhóm = nhóm không tồn tại → xếp như chưa nhóm (LEFT JOIN ra NULL)
export function orderKeyOf(
  item: { id: string; name: string; sort_order: number; category_id: string | null },
  categories: ReadonlyMap<string, { name: string; sort_order: number }>,
): ItemOrderKey {
  const cat = item.category_id === null ? undefined : categories.get(item.category_id);
  return { id: item.id, name: item.name, sort_order: item.sort_order, category: cat ? { name: cat.name, sort_order: cat.sort_order } : null };
}
