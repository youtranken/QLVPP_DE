import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IssueDialog } from './issue-dialog';
import { useStockData } from './use-stock-data';

// Tab Xuất lẻ: xuất một món không cần tìm dòng ở bảng tồn; chỉ món đang dùng còn trong tủ
export function IssueOneButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const d = useStockData();
  const choices = d.rows.filter((r) => r.usable && r.stock_qty > 0);
  return (
    <>
      <button type="button" className="btn btn--primary" disabled={!d.loaded} onClick={() => setOpen(true)}>
        {t('stock.issue.primary')}
      </button>
      {open && <IssueDialog choices={choices} onClose={() => setOpen(false)} />}
    </>
  );
}
