import { useTranslation } from 'react-i18next';
import { DialogTitle } from '@/ui/dialog';
import type { Tone } from '@/lib/group-tone';
import { ItemThumb } from '@/ui/item-thumb';
import type { AdminItem } from './catalog.api';

interface Props {
  item: AdminItem;
  groupName: string;
  position: { index: number; total: number } | null;
  tone: Tone;
}

// Đầu panel Sửa sản phẩm: ảnh · dòng nhỏ mã, nhóm, vị trí · tên (tiêu đề hộp) · trạng thái
export function ItemPanelHead({ item, groupName, position, tone }: Props) {
  const { t } = useTranslation();
  const at = position && position.index >= 0 ? String(position.index + 1) : '—';
  const meta = [item.code, groupName, position ? `${at}/${position.total}` : null].filter(Boolean).join(' · ');
  return (
    <div className="ct-panel-head">
      <ItemThumb fileId={item.image_file_id} alt="" tone={tone} size={56} category={groupName} />
      <div className="ct-panel-head__text">
        <small className="ct-panel-meta">{meta}</small>
        <DialogTitle className="ct-panel-name" aria-label={t('catalog.panel.edit', { name: item.name })}>
          {item.name}
        </DialogTitle>
        <span className={item.usable ? 'ct-panel-status' : 'ct-panel-status is-paused'}>{t(item.usable ? 'catalog.panel.statusActive' : 'common.paused')}</span>
      </div>
    </div>
  );
}
