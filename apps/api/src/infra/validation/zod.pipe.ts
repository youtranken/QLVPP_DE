import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { ErrorCode } from '@vpp/shared';
import type { ZodSchema } from 'zod';

/**
 * Validate body/query bằng Zod: `@Body(new ZodPipe(Schema)) dto: Dto`.
 * Trả `{ code: VALIDATION, fields }` để FE chỉ được đúng ô nhập bị sai.
 */
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION,
        fields: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    return result.data;
  }
}
