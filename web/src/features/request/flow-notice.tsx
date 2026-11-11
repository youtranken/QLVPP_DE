import { useTranslation } from 'react-i18next';
import { IconX } from '@/ui/icons';
import type { SaveFlow } from './use-save-flow';

// Thông báo lưu hỏng / kỳ khóa: một bản duy nhất, nằm trong sheet khi sheet đang mở (nền sau sheet bị ẩn với trình đọc màn hình)
export function FlowNotice({ flow }: { flow: SaveFlow }) {
  const { t } = useTranslation();
  if (!flow.notice) return null;
  return (
    <div className={`rq-notice rq-notice--${flow.noticeTone}`} role="alert" tabIndex={-1} ref={flow.noticeRef}>
      <span>{flow.notice}</span>
      <button type="button" aria-label={t('common.close')} onClick={flow.closeNotice}>
        <IconX width={18} height={18} />
      </button>
    </div>
  );
}
