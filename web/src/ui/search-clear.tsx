import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/ui/icon';

interface Props {
  value: string;
  onClear: () => void;
  // Xóa xong trả focus về ô tìm để gõ tiếp ngay (nút biến mất nên focus không được rơi về body)
  inputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
}

// Nút X riêng của app trong ô tìm (✕ của Chrome đã ẩn ở base.css); chỉ hiện khi có chữ
export function SearchClear({ value, onClear, inputRef, className }: Props) {
  const { t } = useTranslation();
  if (value === '') return null;
  return (
    <button
      type="button"
      className={className ? `search-clear ${className}` : 'search-clear'}
      aria-label={t('common.searchClear')}
      onClick={() => {
        onClear();
        inputRef?.current?.focus();
      }}
    >
      <span className="search-clear-dot" aria-hidden="true">
        <Icon name="x" size={16} />
      </span>
    </button>
  );
}
