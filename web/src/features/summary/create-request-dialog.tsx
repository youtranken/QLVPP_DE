import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiErrorCode, apiErrorNumber, apiErrorString } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import { Dialog, DialogClose, DialogTitle } from '@/ui/dialog';
import { useAdminItems } from '@/features/catalog/catalog.api';
import type { DirectoryUser } from '@/features/directory/directory.api';
import { UserPicker } from '@/features/directory/user-picker';
import { monthOf, useRequestFormat } from '@/features/request/request-format';
import { AddLinePicker } from './add-line-picker';
import { LineRow } from './adjust-lines';
import { SUMMARY_KEY, createOnBehalf } from './summary.api';

interface Line {
  item_id: string;
  qty: number;
}

interface Errors {
  user?: string;
  form?: string;
  lines?: Record<string, string>;
  exists?: { requestId?: string };
}

const USER_CODES = new Set(['USER_NOT_FOUND', 'USER_INACTIVE', 'USER_IS_ADMIN']);
const LINE_CODES = new Set(['QTY_INVALID', 'QTY_EXCEEDS_MAX', 'ITEM_INACTIVE', 'ITEM_NOT_FOUND', 'ADMIN_ONLY_ITEM', 'DUPLICATE_ITEM']);

// Tạo hộ theo luật member (api on_behalf): món chỉ Hành chính không chọn được ở đây
export function CreateRequestDialog({ ym, onClose, onCreated, onOpenExisting }: {
  ym: string;
  onClose: () => void;
  onCreated: () => void;
  onOpenExisting: (requestId: string) => void;
}) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const { csrfToken } = useMe();
  const qc = useQueryClient();
  const items = useAdminItems();
  const [user, setUser] = useState<DirectoryUser | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const byId = useMemo(() => new Map((items.data ?? []).map((i) => [i.id, i])), [items.data]);
  const taken = new Set(lines.map((l) => l.item_id));
  const candidates = (items.data ?? []).filter((i) => i.active && !i.admin_only && !taken.has(i.id));

  const setQty = (itemId: string, qty: number) => {
    setLines((ls) => ls.map((l) => (l.item_id === itemId ? { ...l, qty } : l)));
    setErrors((e) => ({ ...e, lines: undefined }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || lines.length === 0 || saving) return;
    setSaving(true);
    setErrors({});
    try {
      await createOnBehalf({ user_sub: user.sub, lines }, csrfToken);
      void qc.invalidateQueries({ queryKey: SUMMARY_KEY });
      onCreated();
    } catch (err) {
      const code = apiErrorCode(err) ?? '';
      const index = apiErrorNumber(err, 'line_index');
      if (code === 'REQUEST_EXISTS') setErrors({ exists: { requestId: apiErrorString(err, 'request_id') } });
      else if (USER_CODES.has(code)) setErrors({ user: t(`summary.create.errors.${code}`) });
      else if (index !== undefined && lines[index]) {
        const key = LINE_CODES.has(code) ? code : 'OTHER';
        setErrors({ lines: { [lines[index].item_id]: t(`summary.adjust.errors.line.${key}`, { max: apiErrorNumber(err, 'max') }) } });
      } else {
        const known = code === 'LINES_EMPTY' || code === 'PERIOD_LOCKED';
        setErrors({ form: known ? t(`summary.create.errors.${code}`) : t('summary.adjust.errors.UNKNOWN') });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={!!user || lines.length > 0}
      dismissible={!saving}
      className="sheet a-form"
      maxWidth={560}
    >
      <form onSubmit={submit} noValidate>
        <div className="sheet-header">
          <DialogTitle className="sheet-title">
            {t('summary.create.title', { month: monthOf(ym), year: ym.slice(0, 4) })}
          </DialogTitle>
          <DialogClose asChild>
            <button type="button" className="sheet-close" aria-label={t('common.close')} disabled={saving}>
              ✕
            </button>
          </DialogClose>
        </div>
        <div className="sheet-body">
          <p className="ff-hint">{t('summary.create.hint')}</p>
          {errors.exists && (
            <div role="alert" className="alert alert--warn aj-exists">
              <span>{t('summary.create.exists')}</span>
              {errors.exists.requestId && (
                <button type="button" className="btn btn--sm" onClick={() => onOpenExisting(errors.exists!.requestId!)}>
                  {t('summary.create.openAdjust')}
                </button>
              )}
            </div>
          )}
          {errors.form && (
            <p role="alert" className="alert alert--danger">
              {errors.form}
            </p>
          )}
          <UserPicker
            label={t('summary.create.person')}
            searchLabel={t('summary.create.personSearch')}
            value={user}
            excludeAdmin
            error={errors.user}
            onChange={(u) => {
              setUser(u);
              setErrors({});
            }}
          />
          <fieldset className="aj-create-lines">
            <legend className="ff-label">{t('summary.create.lines')}</legend>
            {lines.length === 0 ? (
              <p className="ff-hint">{t('summary.create.empty')}</p>
            ) : (
              <ul className="aj-lines">
                {lines.map((l) => {
                  const item = byId.get(l.item_id);
                  return (
                    <LineRow
                      key={l.item_id}
                      name={item ? fmt.name(item) : l.item_id}
                      unit={fmt.unit(item?.unit ?? null)}
                      qty={l.qty}
                      min={1}
                      max={item?.max_qty ?? l.qty}
                      error={errors.lines?.[l.item_id]}
                      onQty={(n) => setQty(l.item_id, n)}
                      onRemove={() => setLines((ls) => ls.filter((x) => x.item_id !== l.item_id))}
                    />
                  );
                })}
              </ul>
            )}
            <AddLinePicker items={candidates} onPick={(i) => setLines((ls) => [...ls, { item_id: i.id, qty: 1 }])} />
          </fieldset>
        </div>
        <div className="sheet-footer">
          <DialogClose asChild>
            <button type="button" className="btn" disabled={saving}>
              {t('common.cancel')}
            </button>
          </DialogClose>
          <button type="submit" className="btn btn--primary" disabled={!user || lines.length === 0 || saving}>
            {saving ? t('summary.create.saving') : t('summary.create.submit')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
