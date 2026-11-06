import { useEffect, useId, useMemo, useRef } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { DialogClose } from '@/ui/dialog';
import { OverlayPanel, type PanelNav } from '@/ui/overlay-panel';
import { indexCategories } from './catalog-rows';
import type { AdminItem, Category } from './catalog.api';
import { ItemFacts } from './item-facts';
import { ItemFields } from './item-fields';
import { useItemForm, type ItemForm } from './use-item-form';

interface Props {
  item: AdminItem | null;
  categories: Category[];
  defaultCategoryId?: string | null;
  onClose: () => void;
  nav?: Omit<PanelNav, 'prevLabel' | 'nextLabel'>;
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

function Footer({ f, editing, formId }: { f: ItemForm; editing: boolean; formId: string }) {
  const { t } = useTranslation();
  return (
    <>
      <small className="drawer-note">{f.changes > 0 ? t('catalog.drawer.changes', { n: f.changes }) : null}</small>
      <DialogClose asChild>
        <button type="button" className="btn btn--ghost" disabled={f.saving}>
          {t('common.cancel')}
        </button>
      </DialogClose>
      <button type="submit" form={formId} className="btn btn--primary" disabled={f.uploading || f.saving}>
        {f.saving ? t('catalog.form.saving') : t(editing ? 'catalog.form.submitEdit' : 'catalog.form.submitAdd')}
      </button>
    </>
  );
}

export function ItemDrawer({ item, categories, defaultCategoryId, onClose, nav }: Props) {
  const { t } = useTranslation();
  const formId = useId();
  const index = useMemo(() => indexCategories(categories), [categories]);
  const f = useItemForm({ item, defaultCategoryId, onClose });
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (f.attempt > 0) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [f.attempt]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void f.submit();
  };
  return (
    <OverlayPanel
      open
      onClose={onClose}
      title={item ? t('catalog.panel.edit', { name: item.name }) : t('catalog.panel.add')}
      dirty={f.dirty}
      saving={f.saving}
      nav={nav && { ...nav, prevLabel: t('catalog.drawer.prev'), nextLabel: t('catalog.drawer.next') }}
      footer={<Footer f={f} editing={item !== null} formId={formId} />}
    >
      <form id={formId} ref={form} className="ct-panel-form" onSubmit={submit} noValidate>
        <Blocks f={f} />
        <ItemFields draft={f.draft} errors={f.errors} index={index} keepCategoryId={item?.category_id} onChange={f.set} onUploadingChange={f.setUploading} />
        {item && <ItemFacts item={item} />}
        {item && (
          <button type="button" className="btn btn--danger-ghost ct-delete" disabled={f.saving} onClick={() => void f.remove()}>
            {t('catalog.drawer.delete')}
          </button>
        )}
      </form>
    </OverlayPanel>
  );
}
