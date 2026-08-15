import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ErrorCode, khongDau } from '@vpp/shared';
import { eq } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { DB, type Db } from '../../infra/db/db.module';
import { categories, items } from '../../infra/db/schema';
import { AuditService, type AuditActor } from '../audit/audit.service';
import { xemTruocNhap, type DongXemTruoc, type KetQuaXemTruoc } from './catalog-import.parser';

export interface KetQuaGhi {
  daThem: number;
  daCapNhat: number;
  nhomDaTao: number;
  boQua: number;
}

/** Đọc file danh mục (xlsx/csv), xem trước rồi ghi — ADMIN-9. */
@Injectable()
export class CatalogImportService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  async xemTruoc(file: Express.Multer.File): Promise<KetQuaXemTruoc> {
    const luoi = await this.docFile(file);
    const hienCo = await this.layDanhMuc();
    try {
      return xemTruocNhap(luoi, hienCo);
    } catch (error) {
      // Lỗi cấu trúc file là lỗi của người dùng, không phải sự cố hệ thống.
      throw new BadRequestException({
        code: ErrorCode.VALIDATION,
        message: (error as Error).message,
      });
    }
  }

  /**
   * Ghi những dòng đã xem trước vào danh mục.
   *
   * **Không xoá bất cứ thứ gì**: file thiếu món nào thì món đó vẫn còn nguyên.
   * Nhập nhầm file cũ chỉ làm thừa, không làm mất — mà thừa thì sửa được.
   */
  async ghi(dong: DongXemTruoc[], actor: AuditActor): Promise<KetQuaGhi> {
    // Tin vào phân loại của bước xem trước cho phần "thêm hay sửa", nhưng vẫn tự
    // tra lại nhóm/món theo tên khi ghi — dữ liệu có thể đã đổi giữa hai bước.
    const canGhi = dong.filter((d) => d.hanhDong === 'them' || d.hanhDong === 'capNhat');
    const ketQua: KetQuaGhi = {
      daThem: 0,
      daCapNhat: 0,
      nhomDaTao: 0,
      boQua: dong.length - canGhi.length,
    };
    if (canGhi.length === 0) return ketQua;

    await this.db.transaction(async (tx) => {
      const db = tx as unknown as Db;
      const nhomTheoTen = new Map(
        (await db.select({ id: categories.id, name: categories.name }).from(categories)).map(
          (c) => [khongDau(c.name), c.id],
        ),
      );

      for (const d of canGhi) {
        let categoryId = nhomTheoTen.get(khongDau(d.nhom));
        if (!categoryId) {
          const [moi] = await db
            .insert(categories)
            .values({ name: d.nhom })
            .returning({ id: categories.id });
          categoryId = moi.id;
          nhomTheoTen.set(khongDau(d.nhom), categoryId);
          ketQua.nhomDaTao += 1;
        }

        const cungNhom = await db.select().from(items).where(eq(items.categoryId, categoryId));
        const monCu = cungNhom.find((item) => khongDau(item.name) === khongDau(d.ten));

        if (monCu) {
          await db
            .update(items)
            .set({
              code: d.ma || null,
              unit: d.donVi,
              maxQty: d.toiDa,
              adminOnly: d.chiAdmin,
              // Món có trong file nghĩa là đang cung cấp.
              active: true,
            })
            .where(eq(items.id, monCu.id));
          ketQua.daCapNhat += 1;
        } else {
          await db.insert(items).values({
            categoryId,
            code: d.ma || null,
            name: d.ten,
            unit: d.donVi,
            maxQty: d.toiDa,
            adminOnly: d.chiAdmin,
          });
          ketQua.daThem += 1;
        }
      }
    });

    await this.audit.log({
      actor,
      action: 'catalog.import',
      objectType: 'catalog',
      detail: ketQua,
    });
    return ketQua;
  }

  private async layDanhMuc() {
    const [nhom, mon] = await Promise.all([
      this.db.select({ id: categories.id, name: categories.name }).from(categories),
      this.db
        .select({
          id: items.id,
          categoryId: items.categoryId,
          name: items.name,
          code: items.code,
          unit: items.unit,
          maxQty: items.maxQty,
          adminOnly: items.adminOnly,
          active: items.active,
        })
        .from(items),
    ]);
    return { categories: nhom, items: mon };
  }

  /** Đọc xlsx hoặc csv thành lưới ô dạng chuỗi. */
  private async docFile(file: Express.Multer.File): Promise<string[][]> {
    const ten = (file.originalname ?? '').toLowerCase();

    if (ten.endsWith('.csv')) {
      // Tự tách thay vì dùng ExcelJS: bộ đọc CSV của ExcelJS đoán kiểu dữ liệu và
      // biến "01" thành 1, trong khi ở đây mọi ô đều nên coi là chuỗi.
      return docCsv(file.buffer.toString('utf8'));
    }

    if (!ten.endsWith('.xlsx')) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION,
        message: 'Chỉ nhận file .xlsx hoặc .csv.',
      });
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(file.buffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION,
        message: 'Không đọc được file Excel — hãy lưu lại dưới định dạng .xlsx rồi thử lại.',
      });
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION,
        message: 'File Excel không có sheet nào.',
      });
    }

    const luoi: string[][] = [];
    sheet.eachRow({ includeEmpty: true }, (row) => {
      const hang: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, index) => {
        hang[index - 1] = docO(cell);
      });
      luoi.push(hang);
    });
    return luoi;
  }
}

/** Giá trị ô về dạng chuỗi, xử lý cả ô công thức và ô rich text. */
function docO(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if ('result' in value) return String(value.result ?? '');
    if ('richText' in value) return value.richText.map((phan) => phan.text).join('');
    if ('text' in value) return String(value.text);
  }
  return String(value);
}

/**
 * Đoán dấu phân cách của file CSV.
 *
 * Excel bản tiếng Việt/châu Âu xuất CSV dùng dấu **chấm phẩy**, bản tiếng Anh dùng
 * **phẩy**. Không thể nhận cả hai cùng lúc: file dùng phẩy mà có tên món chứa
 * chấm phẩy sẽ bị cắt sai cột. Nên chọn MỘT dấu — dấu nào xuất hiện nhiều hơn ở
 * dòng đầu (ngoài phần trong nháy kép) thì dùng dấu đó.
 */
function doanDauPhanCach(dongDau: string): ',' | ';' {
  let phay = 0;
  let chamPhay = 0;
  let trongNhay = false;
  for (const c of dongDau) {
    if (c === '"') trongNhay = !trongNhay;
    else if (!trongNhay && c === ',') phay += 1;
    else if (!trongNhay && c === ';') chamPhay += 1;
  }
  return chamPhay > phay ? ';' : ',';
}

/**
 * CSV tối giản: ô bọc nháy kép, nháy kép lồng (`""`), xuống dòng trong ô.
 * Đủ cho file Excel "Save as CSV" xuất ra, không cần thêm thư viện.
 */
export function docCsv(text: string): string[][] {
  // Bỏ BOM — Excel bản Windows luôn thêm, và nó dính vào tiêu đề cột đầu tiên.
  const noiDung = text.replace(/^\uFEFF/, '');
  const dauPhanCach = doanDauPhanCach(noiDung.split('\n')[0] ?? '');

  const luoi: string[][] = [];
  let hang: string[] = [];
  let o = '';
  let trongNhay = false;

  for (let i = 0; i < noiDung.length; i += 1) {
    const c = noiDung[i];

    if (trongNhay) {
      if (c === '"') {
        if (noiDung[i + 1] === '"') {
          o += '"';
          i += 1;
        } else trongNhay = false;
      } else o += c;
      continue;
    }

    if (c === '"') trongNhay = true;
    else if (c === dauPhanCach) {
      hang.push(o);
      o = '';
    } else if (c === '\n') {
      hang.push(o);
      luoi.push(hang);
      hang = [];
      o = '';
    } else if (c !== '\r') o += c;
  }

  hang.push(o);
  luoi.push(hang);
  return luoi;
}
