import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useConfirm } from '@/ui/confirm-context';
import { useToast } from '@/ui/toast-context';
import { createItem, deleteItem, patchItem, useRefreshCatalog, type AdminItem } from './catalog.api';
import { catalogErrorKey, fieldErrors, type FieldErrors } from './catalog-errors';
import { ITEM_ERROR_FIELD, ITEM_FIELDS, draftFrom, itemPayload, missingFields, type ItemDraft, type RequiredField } from './item-draft';

const REQUIRED_ERROR: Record<RequiredField, string> = {
  image_file_id: 'catalog.errors.IMAGE_REQUIRED',
  name: 'catalog.errors.NAME_REQUIRED',
  unit: 'catalog.errors.UNIT_REQUIRED',
  max_qty: 'catalog.errors.MAX_REQUIRED',
};

function useItemDraft(item: AdminItem | null, defaultCategoryId: string | null | undefined) {
  const { config } = useMe();
  const key = item?.id ?? 'new';
  const initial = useMemo(() => {
    const draft = draftFrom(item, config.default_max_qty);
    return !item && defaultCategoryId ? { ...draft, category_id: defaultCategoryId } : draft;
  }, [item, defaultCategoryId, config.default_max_qty]);
  const [forKey, setForKey] = useState(key);
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [missing, setMissing] = useState<RequiredField[]>([]);
  const [attempt, setAttempt] = useState(0);
  // Đổi sang món khác ngay trong ngăn kéo (↑/↓) thì bắt đầu lại từ dữ liệu món đó
  if (forKey !== key) {
    setForKey(key);
    setDraft(initial);
    setErrors({});
    setMissing([]);
  }
  const set = <K extends keyof ItemDraft>(field: K, value: ItemDraft[K]) => {
    setDraft((d) => ({ ...d, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined, form: undefined }));
    setMissing((m) => m.filter((f) => f !== field));
  };
  const fail = (next: FieldErrors, miss: RequiredField[] = []) => {
    setMissing(miss);
    setErrors(next);
    setAttempt((n) => n + 1);
  };
  const changes = ITEM_FIELDS.filter((k) => draft[k] !== initial[k]).length;
  return { draft, initial, errors, missing, attempt, changes, set, fail };
}

export function useItemForm({ item, defaultCategoryId, onDone }: { item: AdminItem | null; defaultCategoryId?: string | null; onDone: () => void }) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const refresh = useRefreshCatalog();
  const toast = useToast();
  const confirm = useConfirm();
  const d = useItemDraft(item, defaultCategoryId);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);

  const finish = (text: string) => {
    toast.show({ text, tone: 'ok' });
    void refresh();
    onDone();
  };

  const submit = async () => {
    if (inFlight.current) return;
    const miss = missingFields(d.draft, item ? d.initial : null);
    if (miss.length > 0) return d.fail(Object.fromEntries(miss.map((f) => [f, REQUIRED_ERROR[f]])), miss);
    const payload = itemPayload(d.draft, item);
    if (item && Object.keys(payload).length === 0) return onDone();
    inFlight.current = true;
    setSaving(true);
    try {
      await (item ? patchItem(item.id, payload, csrfToken) : createItem(payload, csrfToken));
      finish(t(item ? 'catalog.drawer.saved' : 'catalog.drawer.added', { name: d.draft.name.trim() }));
    } catch (error) {
      d.fail(fieldErrors(error, ITEM_ERROR_FIELD, ITEM_FIELDS));
      setSaving(false);
    } finally {
      inFlight.current = false;
    }
  };

  const remove = async () => {
    if (!item) return;
    const ok = await confirm({ title: t('catalog.drawer.deleteTitle', { name: item.name }), message: t('catalog.drawer.deleteBody'), confirmLabel: t('catalog.drawer.delete'), danger: true });
    if (!ok || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    try {
      await deleteItem(item.id, csrfToken);
      finish(t('catalog.drawer.deleted', { name: item.name }));
    } catch (error) {
      d.fail({ form: catalogErrorKey(error) });
      setSaving(false);
    } finally {
      inFlight.current = false;
    }
  };

  return { ...d, dirty: d.changes > 0, uploading, saving, setUploading, submit, remove };
}

export type ItemForm = ReturnType<typeof useItemForm>;
