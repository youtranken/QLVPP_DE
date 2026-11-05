import { useEffect, useMemo, useRef } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { discardOptions, useOptionalConfirm } from '@/ui/confirm-context';
import { DialogCloseButton } from '@/ui/dialog';
import { Drawer, DrawerClose, DrawerTitle } from '@/ui/drawer';
import { Icon } from '@/ui/icon';
import { categoryLabel, type AdminItem, type Category } from './catalog.api';
import { NO_GROUP, indexCategories, type CatalogRow } from './catalog-rows';
import { ItemFacts } from './item-facts';
import { ItemFields } from './item-fields';
import { StaffPreview } from './staff-preview';
import { useItemForm, type ItemForm } from './use-item-form';

interface Props {
  item: AdminItem | null;
  categories: Category[];
  rows: CatalogRow[];
  defaultCategoryId?: string | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

function useEyebrow(item: AdminItem | null, rows: CatalogRow[], categories: Category[], defaultCategoryId?: string | null) {
  const { t, i18n } = useTranslation();
  const groupName = (id: string | null | undefined) => {
    const cat = categories.find((c) => c.id === id);
    return cat ? categoryLabel(cat, i18n.language) : t('catalog.page.noCategory');
  };
  if (!item) return defaultCategoryId ? t('catalog.drawer.eyebrowNew', { group: groupName(defaultCategoryId) }) : null;
  const group = rows.find((r) => r.id === item.id)?.group ?? NO_GROUP;
  const k = rows.filter((r) => r.group === group).findIndex((r) => r.id === item.id) + 1;
  return t('catalog.drawer.eyebrow', { group: groupName(group === NO_GROUP ? null : group), k });
}

interface HeaderProps {
  title: string;
  subtitle?: string;
  eyebrow: string | null;
  onStep: (go?: () => void) => void;
  onPrev?: () => void;
  onNext?: () => void;
}

function Header({ title, subtitle, eyebrow, onStep, onPrev, onNext }: HeaderProps) {
  const { t } = useTranslation();
  return (
    <div className="drawer-header ct-drawer-head">
      <div className="ct-drawer-head__text">
        {eyebrow && <small className="drawer-eyebrow">{eyebrow}</small>}
        <DrawerTitle className="sheet-title">
          {title}
          {subtitle && (
            <>
              {' '}
              <span className="ct-drawer-head__sub" title={subtitle}>
                {subtitle}
              </span>
            </>
          )}
        </DrawerTitle>
      </div>
      <button type="button" className="btn btn--ghost btn--sm ct-icon-btn" aria-label={t('catalog.drawer.prev')} disabled={!onPrev} onClick={() => onStep(onPrev)}>
        <Icon name="chevup" size={18} />
      </button>
      <button type="button" className="btn btn--ghost btn--sm ct-icon-btn" aria-label={t('catalog.drawer.next')} disabled={!onNext} onClick={() => onStep(onNext)}>
        <Icon name="chev" size={18} />
      </button>
      <DialogCloseButton />
    </div>
  );
}

function Blocks({ f }: { f: ItemForm }) {
  const { t } = useTranslation();
  const list = f.missing.map((k) => t(`catalog.drawer.need.${k}`)).join(', ');
  return (
    <>
      {f.missing.length > 0 && (
        <p role="alert" className="alert alert--danger">
          {t('catalog.drawer.missing', { list })}
        </p>
      )}
      {f.errors.form && (
        <p role="alert" className="alert alert--danger">
          {t(f.errors.form)}
        </p>
      )}
    </>
  );
}

function Footer({ f, editing }: { f: ItemForm; editing: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="drawer-footer">
      <small className="drawer-note">{f.changes > 0 ? t('catalog.drawer.changes', { n: f.changes }) : null}</small>
      <DrawerClose asChild>
        <button type="button" className="btn btn--ghost" disabled={f.saving}>
          {t('common.cancel')}
        </button>
      </DrawerClose>
      <button type="submit" className="btn btn--primary" disabled={f.uploading || f.saving}>
        {f.saving ? t('catalog.form.saving') : t(editing ? 'catalog.form.submitEdit' : 'catalog.form.submitAdd')}
      </button>
    </div>
  );
}

export function ItemDrawer({ item, categories, rows, defaultCategoryId, onClose, onPrev, onNext }: Props) {
  const { t } = useTranslation();
  const index = useMemo(() => indexCategories(categories), [categories]);
  const f = useItemForm({ item, defaultCategoryId, onDone: onClose });
  const eyebrow = useEyebrow(item, rows, categories, defaultCategoryId);
  const askConfirm = useOptionalConfirm();
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (f.attempt > 0) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [f.attempt]);
  const step = (go?: () => void) => {
    if (!go) return;
    if (!f.dirty || !askConfirm) return go();
    void askConfirm(discardOptions(t)).then((ok) => ok && go());
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void f.submit();
  };
  const prev = f.saving ? undefined : onPrev;
  const next = f.saving ? undefined : onNext;
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} dirty={f.dirty} dismissible={!f.saving} onPrev={prev} onNext={next}>
      <Header title={t(item ? 'catalog.form.editTitle' : 'catalog.form.addTitle')} subtitle={item?.name} eyebrow={eyebrow} onStep={step} onPrev={prev} onNext={next} />
      <form ref={form} className="ct-drawer-form" onSubmit={submit} noValidate>
        <div className="drawer-body">
          <Blocks f={f} />
          <ItemFields draft={f.draft} errors={f.errors} index={index} keepCategoryId={item?.category_id} onChange={f.set} onUploadingChange={f.setUploading} />
          <StaffPreview draft={f.draft} tone={index.tone.get(f.draft.category_id) ?? 'g0'} />
          {item && <ItemFacts item={item} />}
          {item && (
            <button type="button" className="btn btn--danger-ghost ct-delete" disabled={f.saving} onClick={() => void f.remove()}>
              {t('catalog.drawer.delete')}
            </button>
          )}
        </div>
        <Footer f={f} editing={item !== null} />
      </form>
    </Drawer>
  );
}
