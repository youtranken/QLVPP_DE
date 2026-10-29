import { BadRequestException, ValidationError } from '@nestjs/common';

interface Leaf {
  field: string;
  messages: string[];
  lineIndex?: number;
}

// Lỗi lồng (lines[i].custom_name) báo trường lá + line_index như lỗi dòng của writer
function leaves(error: ValidationError, lineIndex?: number): Leaf[] {
  const own = Object.values(error.constraints ?? {});
  const here = own.length
    ? [{ field: error.property, messages: own, lineIndex }]
    : [];
  const children = (error.children ?? []).flatMap((child) =>
    leaves(child, lineIndexOf(error, child) ?? lineIndex),
  );
  return [...here, ...children];
}

function lineIndexOf(
  parent: ValidationError,
  child: ValidationError,
): number | undefined {
  return parent.property === 'lines' && /^\d+$/.test(child.property)
    ? Number(child.property)
    : undefined;
}

export function validationException(
  errors: ValidationError[],
): BadRequestException {
  const all = errors.flatMap((e) => leaves(e));
  const lineIndex = all.find((l) => l.lineIndex !== undefined)?.lineIndex;
  return new BadRequestException({
    code: 'VALIDATION',
    message: all.flatMap((l) => l.messages).join('; '),
    fields: [...new Set(all.map((l) => l.field))],
    ...(lineIndex === undefined ? {} : { line_index: lineIndex }),
  });
}
