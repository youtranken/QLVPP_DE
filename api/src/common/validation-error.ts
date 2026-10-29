import { BadRequestException, ValidationError } from '@nestjs/common';

interface Leaf {
  field: string;
  messages: string[];
  lineIndex?: number;
}

const isLineElement = (parent: string[], error: ValidationError) =>
  parent.length === 1 && parent[0] === 'lines' && /^\d+$/.test(error.property);

// lines[i] báo trường lá + line_index như lỗi dòng của writer; lồng khác giữ đường dẫn để không trùng tên cấp trên
function leaves(
  error: ValidationError,
  parent: string[],
  lineIndex?: number,
): Leaf[] {
  const atLine = isLineElement(parent, error);
  const index = atLine ? Number(error.property) : lineIndex;
  const path = atLine ? [] : [...parent, error.property];
  const own = Object.values(error.constraints ?? {});
  const here = own.length
    ? [{ field: path.join('.') || 'lines', messages: own, lineIndex: index }]
    : [];
  const children = (error.children ?? []).flatMap((child) =>
    leaves(child, path, index),
  );
  return [...here, ...children];
}

// Nhiều dòng lỗi → body chỉ mô tả dòng lỗi đầu tiên (web gắn một lỗi vào một dòng); lỗi ngoài lines luôn giữ
export function validationException(
  errors: ValidationError[],
): BadRequestException {
  const all = errors.flatMap((e) => leaves(e, []));
  const indexes = all.flatMap((l) =>
    l.lineIndex === undefined ? [] : [l.lineIndex],
  );
  const lineIndex = indexes.length ? Math.min(...indexes) : undefined;
  const shown = all.filter(
    (l) => l.lineIndex === undefined || l.lineIndex === lineIndex,
  );
  return new BadRequestException({
    code: 'VALIDATION',
    message: shown.flatMap((l) => l.messages).join('; '),
    fields: [...new Set(shown.map((l) => l.field))],
    ...(lineIndex === undefined ? {} : { line_index: lineIndex }),
  });
}
