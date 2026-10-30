import { sql, type SQL } from 'drizzle-orm';

// So group không phân biệt hoa thường như resolveRole; dùng chung cho mọi truy vấn cần biết "thuộc Hành chính"
export const inAdminGroup = (groups: SQL, adminGroup: string): SQL =>
  sql`(jsonb_typeof(${groups}) = 'array' AND EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(${groups}) g
    WHERE lower(g) = lower(${adminGroup})))`;
