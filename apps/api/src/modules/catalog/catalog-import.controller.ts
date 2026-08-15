import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ErrorCode } from '@vpp/shared';
import { z } from 'zod';
import type { AuthenticatedUser } from '../../auth/auth.service';
import { CurrentUser, Roles } from '../../auth/roles.decorator';
import { ZodPipe } from '../../infra/validation/zod.pipe';
import type { DongXemTruoc } from './catalog-import.parser';
import { CatalogImportService } from './catalog-import.service';

/** File danh mục thường chỉ vài chục KB; 2MB đã là rộng rãi. */
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

/**
 * Bảng xem trước gửi lên NGUYÊN VẸN, gồm cả dòng lỗi và dòng không đổi, để phía
 * server đếm được "bỏ qua bao nhiêu". Vì vậy khung ngoài phải lỏng — dòng lỗi
 * đúng nghĩa là dòng có ô trống.
 *
 * Siết chặt chỉ áp cho dòng THỰC SỰ ĐƯỢC GHI: đó mới là chỗ dữ liệu xấu gây hại.
 */
const DongSchema = z
  .object({
    dong: z.number().int(),
    ma: z.string().max(30),
    nhom: z.string().max(120),
    ten: z.string().max(120),
    donVi: z.string().max(30),
    toiDa: z.number().int().min(0).max(999),
    chiAdmin: z.boolean(),
    hanhDong: z.enum(['them', 'capNhat', 'khongDoi', 'loi']),
    ghiChu: z.string(),
  })
  .superRefine((d, ctx) => {
    if (d.hanhDong !== 'them' && d.hanhDong !== 'capNhat') return;
    const batBuoc: [keyof typeof d, string][] = [
      ['nhom', 'Thiếu tên nhóm'],
      ['ten', 'Thiếu tên món'],
      ['donVi', 'Thiếu đơn vị tính'],
    ];
    for (const [truong, message] of batBuoc) {
      if (!String(d[truong]).trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [truong], message });
      }
    }
    if (d.toiDa < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['toiDa'], message: 'Tối đa phải ≥ 1' });
    }
  });

/**
 * Ghi đúng những dòng admin đã XEM TRƯỚC, thay vì tải file lên lần nữa rồi đọc
 * lại: cái được ghi phải đúng bằng cái người ta vừa nhìn thấy và đồng ý.
 */
const GhiSchema = z.object({ dong: z.array(DongSchema).min(1).max(2000) });
type GhiDto = z.infer<typeof GhiSchema>;

/** Nhập danh mục từ file Excel/CSV — ADMIN-9. */
@Roles('admin')
@Controller('api/admin/catalog/import')
export class CatalogImportController {
  constructor(private readonly nhap: CatalogImportService) {}

  @Post('preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMPORT_BYTES } }))
  xemTruoc(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION, message: 'Thiếu file tải lên.' });
    }
    return this.nhap.xemTruoc(file);
  }

  @Post('apply')
  ghi(@CurrentUser() admin: AuthenticatedUser, @Body(new ZodPipe(GhiSchema)) body: GhiDto) {
    return this.nhap.ghi(body.dong as DongXemTruoc[], { id: admin.id, name: admin.name });
  }
}
