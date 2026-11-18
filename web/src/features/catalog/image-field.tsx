import { useId } from 'react';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ACCEPT_ATTR } from '@/lib/image-input';
import type { Tone } from '@/lib/group-tone';
import { Icon } from '@/ui/icon';
import { ImageCropper } from '@/ui/image-cropper';
import { fileUrl } from '@/features/catalog/catalog.api';
import { useItemImage } from '@/features/catalog/use-item-image';
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
  const noteId = useId();
  const img = useItemImage(onChange, onBusyChange);
  const { busy } = img;
  const localError = img.error;
  const shownError = localError ?? error;

  const fileInput = (label: string) => (
    <input
      type="file"
      className="sr-only"
      accept={ACCEPT_ATTR}
      aria-label={label}
      aria-invalid={shownError ? true : undefined}
      aria-describedby={noteId}
      disabled={busy}
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        img.pick(e.target.files?.[0]);
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
            <button type="button" className="btn btn--sm" disabled={busy} onClick={() => img.recrop(fileId)}>
              {t('catalog.form.imageRecrop')}
            </button>
            {/* Ảnh bắt buộc: xóa xong không lưu được nên chỉ cho đổi */}
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
      {!busy && (
        <p className="ff-hint">
          {t('catalog.form.imagePasteHint')}
        </p>
      )}
      {img.source && (
        <ImageCropper
          title={t('catalog.form.cropTitle')}
          source={img.source}
          busy={busy}
          onConfirm={(r) => void img.confirm(r)}
          onCancel={img.cancel}
        />
      )}
    </fieldset>
  );
}
