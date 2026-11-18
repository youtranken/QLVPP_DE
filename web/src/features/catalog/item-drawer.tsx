import { useEffect, useId, useMemo, useRef } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { DialogClose } from '@/ui/dialog';
import type { ToastSpec } from '@/ui/toast-context';
import { OverlayPanel, type PanelNav } from '@/ui/overlay-panel';
import { categoryLabel, useRefreshCatalog, type AdminItem, type Category } from './catalog.api';
import { indexCategories, type CategoryIndex } from './catalog-rows';
import { ItemFacts } from './item-facts';
import { ItemFields } from './item-fields';
import { ItemPanelHead } from './item-panel-head';
import { useItemActive } from './use-item-active';
import { useDisabledReason } from '@/ui/disabled-reason';
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

// Toast nằm trong panel (toast chung ngoài hộp bị ẩn khỏi trình đọc màn hình)
function ActiveToggle({ item, groupActive, saving, notify }: { item: AdminItem; groupActive: boolean; saving: boolean; notify: (toast: ToastSpec) => void }) {
  const { t } = useTranslation();
  const refresh = useRefreshCatalog();
  const { checked, locked, send } = useItemActive({ item, name: item.name, groupActive, refresh, notify, confirmEach: true });
  const hintId = useId();
  return (
    <>
      <button
        type="button"
        className={checked ? 'btn btn--danger-line' : 'btn'}
        aria-label={t(checked ? 'catalog.grid.pauseFor' : 'catalog.grid.reactivateFor', { name: item.name })}
        aria-describedby={locked ? hintId : undefined}
        disabled={saving || locked}
        onClick={() => void send(!checked)}
      >
        {t(checked ? 'catalog.grid.pause' : 'catalog.categories.reactivate')}
      </button>
      {locked && (
        <small id={hintId} className="ct-active__hint">
          {t('catalog.categories.enableGroupFirst')}
        </small>
      )}
    </>
  );
}

function Footer({ f, item, groupActive, formId }: { f: ItemForm; item: AdminItem | null; groupActive: boolean; formId: string }) {
  const { t } = useTranslation();
  const fix = useDisabledReason(f.invalid ? t('common.disabledReason.fixErrors') : null);
  return (
    <>
      {item && (
        <div className="ct-foot-left">
          <ActiveToggle item={item} groupActive={groupActive} saving={f.saving} notify={f.notify} />
          <button type="button" className="btn btn--danger-line ct-delete" disabled={f.saving} onClick={() => void f.remove()}>
            {t('catalog.drawer.delete')}
          </button>
        </div>
      )}
      <small className="drawer-note">{f.changes > 0 ? t('catalog.drawer.changes', { n: f.changes }) : null}</small>
      <DialogClose asChild>
        <button type="button" className="btn" disabled={f.saving}>
          {t('common.cancel')}
        </button>
      </DialogClose>
      <button type="submit" form={formId} className="btn btn--primary" disabled={f.uploading || f.saving || f.invalid} aria-describedby={fix.describedBy}>
        {f.saving ? t('catalog.form.saving') : t(item ? 'catalog.form.submitEdit' : 'catalog.form.submitAdd')}
      </button>
      {fix.node}
    </>
  );
}

function headOf(item: AdminItem | null, index: CategoryIndex, language: string, nav: Props['nav']) {
  if (!item) return undefined;
  const cat = item.category_id ? index.byId.get(item.category_id) : undefined;
  return <ItemPanelHead item={item} groupName={cat ? categoryLabel(cat, language) : ''} tone={(item.category_id && index.tone.get(item.category_id)) || 'g0'} position={nav ? { index: nav.index, total: nav.total } : null} />;
}

export function ItemDrawer({ item, categories, defaultCategoryId, onClose, nav }: Props) {
  const { t, i18n } = useTranslation();
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
      wide
      onClose={onClose}
      title={item ? t('catalog.panel.edit', { name: item.name }) : t('catalog.panel.add')}
      dirty={f.dirty}
      saving={f.saving}
      nav={nav && { ...nav, prevLabel: t('catalog.drawer.prev'), nextLabel: t('catalog.drawer.next') }}
      head={headOf(item, index, i18n.language, nav)}
      footer={<Footer f={f} item={item} groupActive={item?.category_id ? (index.byId.get(item.category_id)?.active ?? true) : true} formId={formId} />}
    >
      <form id={formId} ref={form} className="ct-panel-form" onSubmit={submit} noValidate>
        <Blocks f={f} />
        <ItemFields draft={f.draft} errors={f.errors} index={index} keepCategoryId={item?.category_id} onChange={f.set} onUploadingChange={f.setUploading} />
        {item && <ItemFacts item={item} />}
      </form>
      {f.toastHost}
    </OverlayPanel>
  );
}
