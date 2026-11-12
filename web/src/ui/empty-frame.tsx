import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyArt, type EmptyArtKind } from '@/ui/empty-art';

// "no-match": có dữ liệu nhưng bộ lọc/tìm không ra → luôn kính lúp, nút Xóa lọc khi có onClear.
// "empty": chưa có dữ liệu → hình riêng của màn (mặc định tờ phiếu trống), không bao giờ kính lúp,
// để người dùng phân biệt "lọc sai" với "chưa có gì" chỉ qua một cái nhìn
export type EmptyVariant = 'no-match' | 'empty';

export interface EmptyFrameProps {
  variant?: EmptyVariant;
  title: string;
  hint?: string;
  // Hình riêng cho biến thể "empty": tên trong bộ empty-art hoặc một minh họa tự vẽ
  art?: EmptyArtKind | ReactNode;
  action?: ReactNode;
  onClear?: () => void;
  // Trong bảng (DataTable): bảng đã là thẻ nên bỏ nền thẻ, tiêu đề không là heading
  flush?: boolean;
}

// Khung trống chung của trang quản trị: rộng hết vùng danh sách, khối chữ tối đa 480 px căn giữa
export function EmptyFrame({ variant = 'empty', title, hint, art, action, onClear, flush = false }: EmptyFrameProps) {
  const { t } = useTranslation();
  const picture = variant === 'no-match' ? <EmptyArt kind="no-match" /> : typeof art === 'string' ? <EmptyArt kind={art as EmptyArtKind} /> : (art ?? <EmptyArt kind="no-request" />);
  const clear =
    variant === 'no-match' && onClear ? (
      <button type="button" className="btn" onClick={onClear}>
        {t('common.filter.clear')}
      </button>
    ) : null;
  return (
    <div className={flush ? 'empty-state empty-state--flush' : 'empty-state'} data-variant={variant}>
      <div className="empty-state__body">
        {picture}
        {flush ? <p className="empty-state__title">{title}</p> : <h2 className="empty-state__title">{title}</h2>}
        {hint && <p className="empty-state__hint">{hint}</p>}
        {clear ?? action}
      </div>
    </div>
  );
}
