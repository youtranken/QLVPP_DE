import { useTranslation } from 'react-i18next';
import { diffTone } from './diff-tone';


// Luôn có chữ, không chỉ màu; dòng trong bảng nên dùng role="status"
export function DiffNote({ d, order, unit }: { d: number; order: number; unit: string }) {
  const { t } = useTranslation();
  const tone = diffTone(d);
  const text =
    tone === 'ok'
      ? t('warn.W1a')
      : tone === 'short'
        ? t('warn.W1b', { n: -d, unit })
        : t(order > 0 ? 'warn.W1c' : 'warn.W1d', { n: d });
  return (
    <span role="status" className="diff-note" data-tone={tone}>
      {text}
    </span>
  );
}
