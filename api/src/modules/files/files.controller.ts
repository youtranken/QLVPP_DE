import {
  Body,
  CallHandler,
  Controller,
  Get,
  Injectable,
  NestInterceptor,
  NotFoundException,
  Param,
  PayloadTooLargeException,
  Post,
  Req,
  Res,
  StreamableFile,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Observable, catchError, throwError } from 'rxjs';
import type { AuthedRequest, RequestIdentity } from '../auth/identity.types';
import { FileAccessPolicy } from './file-access.policy';
import { MAX_IMAGE_BYTES } from './file-validation';
import { FilesService, storedPath } from './files.service';

// Multer ném PayloadTooLarge chung chung; đổi sang mã nghiệp vụ để FE hiển thị đúng thông báo
@Injectable()
class FileTooLargeInterceptor implements NestInterceptor {
  intercept(_ctx: unknown, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) =>
        throwError(() =>
          error instanceof PayloadTooLargeException
            ? new PayloadTooLargeException({
                code: 'FILE_TOO_LARGE',
                message: 'Ảnh vượt quá 5 MB.',
              })
            : error,
        ),
      ),
    );
  }
}

function identityOf(req: AuthedRequest): RequestIdentity {
  if (!req.user) {
    throw new UnauthorizedException({
      code: 'UNAUTHENTICATED',
      message: 'Chưa đăng nhập.',
    });
  }
  return req.user;
}

@Controller('files')
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly policy: FileAccessPolicy,
  ) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(
    FileTooLargeInterceptor,
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('purpose') purpose: unknown,
    @Req() req: AuthedRequest,
  ) {
    return this.files.upload(file, purpose, identityOf(req).sub);
  }

  // Không tồn tại và không được xem cùng trả 404 để không lộ id hợp lệ
  @Get(':id')
  async read(
    @Param('id') id: string,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.policy.findReadable(id, identityOf(req));
    const path = file ? storedPath(file.id, file.mime) : null;
    if (!file || !path || !(await stat(path).catch(() => null))) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Không tìm thấy tệp.',
      });
    }
    res.set({
      'Content-Type': file.mime,
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=86400',
    });
    return new StreamableFile(createReadStream(path));
  }
}
