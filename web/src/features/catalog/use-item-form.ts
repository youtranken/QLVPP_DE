import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { undoActions } from '@/lib/undo.api';
import { usePanelToast } from '@/ui/panel-toast';
import { TOAST_MS } from '@/ui/toast-provider';
import { useToast } from '@/ui/toast-context';
import { createItem, deleteItem, patchItem, useRefreshCatalog, type AdminItem } from './catalog.api';
import { catalogErrorKey, fieldErrors, type FieldErrors } from './catalog-errors';
import { ITEM_ERROR_FIELD, ITEM_FIELDS, draftFrom, itemPayload, missingFields, validMaxQty, type ItemDraft, type RequiredField } from './item-draft';

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
  // Cùng biên DTO (@Min(1) @Max(999), số nguyên): báo ngay khi gõ, để trống thì để lượt Lưu báo "bắt buộc"
  const maxInvalid = draft.max_qty.trim() !== '' && !validMaxQty(draft.max_qty);
  const shown = maxInvalid && !errors.max_qty ? { ...errors, max_qty: 'catalog.errors.MAX_RANGE' } : errors;
  return { draft, initial, errors: shown, invalid: maxInvalid, missing, attempt, changes, set, fail };
}

// Sửa món: lưu xong panel ở lại món đó; thêm món và xóa món thì đóng panel
export function useItemForm({ item, defaultCategoryId, onClose }: { item: AdminItem | null; defaultCategoryId?: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const refresh = useRefreshCatalog();
  const toast = useToast();
  // Lưu xong panel còn mở: toast phải nằm trong panel, toast chung ngoài hộp bị ẩn khỏi trình đọc màn hình
  const panelToast = usePanelToast(TOAST_MS);
  const d = useItemDraft(item, defaultCategoryId);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const inFlight = useRef(false);

  const finish = (text: string, close: boolean, undo?: () => Promise<unknown>, undoSince?: number) => {
    void refresh();
    if (!close) {
      panelToast.show({ text, tone: 'ok' });
      return setSaving(false);
    }
    toast.show({ text, tone: 'ok', undo, undoSince });
    // Đã lưu/xóa xong: nháp không còn là "chưa lưu", đóng không hỏi và không chặn rời trang
    setClosing(true);
    onClose();
  };

  const submit = async () => {
    if (inFlight.current) return;
    const miss = missingFields(d.draft, item ? d.initial : null);
    if (miss.length > 0) return d.fail(Object.fromEntries(miss.map((f) => [f, REQUIRED_ERROR[f]])), miss);
    const payload = itemPayload(d.draft, item);
    if (item && Object.keys(payload).length === 0) return;
    inFlight.current = true;
    setSaving(true);
    try {
      await (item ? patchItem(item.id, payload, csrfToken) : createItem(payload, csrfToken));
      finish(t(item ? 'catalog.drawer.saved' : 'catalog.drawer.added', { name: d.draft.name.trim() }), !item);
    } catch (error) {
      d.fail(fieldErrors(error, ITEM_ERROR_FIELD, ITEM_FIELDS));
      setSaving(false);
    } finally {
      inFlight.current = false;
    }
  };

  // TC-18: xóa làm lại được trong 5 giây nên không hỏi "Bạn chắc chưa?"
  const remove = async () => {
    if (!item || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    const sentAt = Date.now();
    try {
      const { undo_id } = await deleteItem(item.id, csrfToken);
      finish(t('catalog.drawer.deleted', { name: item.name }), true, () => undoActions('item-delete', [undo_id], csrfToken).then(refresh), sentAt);
    } catch (error) {
      d.fail({ form: catalogErrorKey(error) });
      setSaving(false);
    } finally {
      inFlight.current = false;
    }
  };

  return { ...d, dirty: d.changes > 0 && !closing, uploading, saving, setUploading, submit, remove, toastHost: panelToast.host, notify: panelToast.show };
}

export type ItemForm = ReturnType<typeof useItemForm>;
