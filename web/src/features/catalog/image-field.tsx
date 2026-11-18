import { useId, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { compressImage } from '@/lib/image-compress';
import type { Tone } from '@/lib/group-tone';
import { useMe } from '@/lib/me';
import { Icon } from '@/ui/icon';
import { fileUrl, uploadItemImage } from '@/features/catalog/catalog.api';
import { catalogErrorKey } from '@/features/catalog/catalog-errors';
import '@/features/catalog/catalog.m1.css';

export function ImageField({
  fileId,
  error,
  required = false,
  tone = 'g0',
  onChange,
  onBusyChange,
}: {
  fileId: string | null;
  error?: string;
  required?: boolean;
  tone?: Tone;
  onChange: (fileId: string | null) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const noteId = useId();
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const shownError = localError ?? error;

  const setBusyBoth = (b: boolean) => {
    setBusy(b);
    onBusyChange(b);
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setLocalError(null);
    setBusyBoth(true);
    try {
      const out = await compressImage(file);
      if ('error' in out) {
        setLocalError(t('catalog.errors.IMAGE_UNSUPPORTED'));
        return;
      }
      const { id } = await uploadItemImage(out.blob, out.mime, csrfToken);
      onChange(id);
    } catch (e) {
      const key = catalogErrorKey(e);
      setLocalError(t(key === 'catalog.errors.UNKNOWN' ? 'catalog.errors.UPLOAD_FAILED' : key));
    } finally {
      setBusyBoth(false);
    }
  };

  const fileInput = (label: string) => (
    <input
      type="file"
      className="sr-only"
      accept="image/*"
      aria-label={label}
      aria-invalid={shownError ? true : undefined}
      aria-describedby={noteId}
      disabled={busy}
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        void pick(e.target.files?.[0]);
        e.target.value = '';
      }}
    />
  );

  return (
    <fieldset className={`ct-img${shownError ? ' ff--error' : ''}`}>
      <legend className="ff-label">
        {t('catalog.form.image')}
        {required && <span className="ff-req" aria-hidden="true"> *</span>}
      </legend>
      {fileId ? (
        <div className="ct-img__row">
          <span className="ct-img__frame" style={{ background: `var(--${tone})` }}>
            <img src={fileUrl(fileId)} alt={t('catalog.form.imageAlt')} />
          </span>
          <span className="ct-img__actions">
            <label className={`btn btn--sm${busy ? ' is-disabled' : ''}`}>
              {busy ? t('catalog.form.imageUploading') : t('catalog.form.imageChange')}
              {fileInput(t('catalog.form.imageChange'))}
            </label>
            {/* Ảnh bắt buộc: xóa xong không lưu được nên chỉ cho đổi (AD-46) */}
            {!required && (
              <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={() => onChange(null)}>
                {t('catalog.form.imageRemove')}
              </button>
            )}
          </span>
        </div>
      ) : (
        <label className={`ct-img__frame ct-img__pick${busy ? ' is-disabled' : ''}`}>
          <Icon name="image" size={24} />
          <span>{busy ? t('catalog.form.imageUploading') : t('catalog.form.imagePick')}</span>
          {fileInput(t('catalog.form.imagePick'))}
        </label>
      )}
      {/* Lỗi tải ảnh xảy ra ngoài lúc bấm Lưu: phần tử mới role=alert để trình đọc màn hình đọc ngay.
          Lỗi từ form (prop error) đã có hộp tóm tắt đầu form báo, không đọc trùng */}
      {shownError ? (
        <p key="error" id={noteId} role={localError ? 'alert' : undefined} className="ff-error">
          {shownError}
        </p>
      ) : (
        <p key="hint" id={noteId} className="ff-hint">
          {t('catalog.form.imageHint')}
        </p>
      )}
    </fieldset>
  );
}
