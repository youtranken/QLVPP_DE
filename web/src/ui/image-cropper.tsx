import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { findContentBox, nudgeCrop } from '@/lib/crop-rect';
import type { Handle, Rect } from '@/lib/crop-rect';
import type { CropSource } from '@/lib/crop-source';
import { Dialog, DialogTitle } from '@/ui/dialog';
import { useCropDrag } from '@/ui/use-crop-drag';

const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const KEY_STEP = 10;

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

export function ImageCropper({
  title,
  source,
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: {
  title: string;
  source: CropSource;
  busy?: boolean;
  error?: string | null;
  onConfirm: (rect: Rect) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const bounds = { width: source.width, height: source.height };
  const whole: Rect = { x: 0, y: 0, w: source.width, h: source.height };
  const [rect, setRect] = useState<Rect>(whole);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useCropDrag(canvasRef, rect, bounds, setRect);

  useEffect(() => {
    if (canvasRef.current) source.draw(canvasRef.current);
  }, [source]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = nudgeCrop(rect, e.key, e.shiftKey, bounds, KEY_STEP);
    if (!next) return;
    e.preventDefault();
    setRect(next);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()} className="sheet" maxWidth={640} closeOnOutside={false}>
      <div className="sheet-header">
        <DialogTitle className="sheet-title">{title}</DialogTitle>
      </div>
      <div className="sheet-body crop">
        <div className="crop__area">
          <div className="crop__stage">
            <canvas ref={canvasRef} width={source.width} height={source.height} className="crop__canvas" />
            <div
              role="group"
              aria-label={t('common.cropper.box')}
              aria-describedby="crop-help"
              tabIndex={0}
              className="crop__box"
              style={{
                left: pct(rect.x, source.width),
                top: pct(rect.y, source.height),
                width: pct(rect.w, source.width),
                height: pct(rect.h, source.height),
              }}
              onKeyDown={onKeyDown}
              {...drag}
            >
              {HANDLES.map((h) => (
                <i key={h} data-grip={h} data-testid={`crop-handle-${h}`} className={`crop__h crop__h--${h}`} />
              ))}
            </div>
          </div>
        </div>
        <p id="crop-help" className="ff-hint">
          {t('common.cropper.help')}
        </p>
        <div className="crop__tools">
          <button type="button" className="btn btn--sm" onClick={() => setRect(findContentBox(source.pixels()))}>
            {t('common.cropper.trim')}
          </button>
          <button type="button" className="btn btn--sm" onClick={() => setRect(whole)}>
            {t('common.cropper.full')}
          </button>
          <span className="crop__size">{t('common.cropper.size', { w: rect.w, h: rect.h })}</span>
        </div>
        {error && (
          <p role="alert" className="ff-error">
            {error}
          </p>
        )}
      </div>
      <div className="sheet-footer">
        <button type="button" className="btn btn--ghost" disabled={busy} onClick={onCancel}>
          {t('common.cropper.cancel')}
        </button>
        <button type="button" className="btn btn--primary" disabled={busy} onClick={() => onConfirm(rect)}>
          {t('common.cropper.use')}
        </button>
      </div>
    </Dialog>
  );
}
