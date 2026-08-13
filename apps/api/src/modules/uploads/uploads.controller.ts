import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ErrorCode } from '@vpp/shared';
import type { Response } from 'express';
import { parseEnv } from '../../infra/config/env';

/** Ảnh đính kèm mục "Khác": chỉ ảnh, tối đa 5MB (SDD §9). */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Chỉ nhận vài định dạng ảnh phổ biến — không nhận mọi thứ `image/*`. */
const ALLOWED_EXTENSIONS = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

/** Tên file do server sinh: uuid + đuôi. Chỉ khớp đúng dạng này mới được phục vụ. */
const SAFE_FILENAME = /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/;

@Controller('api/uploads')
export class UploadsController {
  private readonly uploadDir = resolve(parseEnv().UPLOAD_DIR);

  /**
   * Nhận ảnh, trả về đường dẫn để gắn vào dòng đơn.
   * Giữ file trong bộ nhớ rồi tự ghi (thay vì để multer ghi thẳng) để chỉ những
   * file đã qua kiểm mới nằm lại trên đĩa.
   */
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async upload(@UploadedFile() file?: Express.Multer.File): Promise<{ path: string }> {
    if (!file) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION, message: 'Thiếu file tải lên.' });
    }

    const extension = ALLOWED_EXTENSIONS.get(file.mimetype);
    if (!extension) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION,
        message: 'Chỉ nhận ảnh JPG, PNG, WEBP hoặc GIF.',
      });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION,
        message: 'Ảnh vượt quá 5MB.',
      });
    }

    const filename = `${randomUUID()}${extension}`;
    await mkdir(this.uploadDir, { recursive: true });
    await writeFile(join(this.uploadDir, filename), file.buffer);
    return { path: `/api/uploads/${filename}` };
  }

  /**
   * Phục vụ ảnh qua stream.
   * Chống path traversal bằng cách CHỈ chấp nhận tên file đúng khuôn server sinh ra —
   * an toàn hơn là cố lọc `..` khỏi chuỗi người dùng gửi lên.
   */
  @Get(':filename')
  async serve(@Param('filename') filename: string, @Res() res: Response): Promise<void> {
    if (!SAFE_FILENAME.test(filename)) throw new NotFoundException({ code: ErrorCode.NOT_FOUND });

    const filePath = join(this.uploadDir, filename);
    try {
      await stat(filePath);
    } catch {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND });
    }

    const type = [...ALLOWED_EXTENSIONS].find(([, ext]) => ext === extname(filename))?.[0];
    if (type) res.type(type);
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    createReadStream(filePath).pipe(res);
  }
}
