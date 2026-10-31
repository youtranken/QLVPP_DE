import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useToast } from '@/ui/toast-context';
import { CONFIG_KEY, saveConfig, type AdminConfig } from './admin.api';
import { configErrorField } from './admin-errors';
import type { BlockSpec, FieldErrors } from './config-form';

export type BlockStatus = 'idle' | 'saving' | 'saved';

export interface ConfigBlockState<D> {
  draft: D;
  errors: FieldErrors;
  status: BlockStatus;
  dirty: boolean;
  update: (next: (d: D) => D, clear?: string | 'all') => void;
  save: () => Promise<void>;
  cancel: () => void;
}

export function useConfigBlock<D>(spec: BlockSpec<D>, config: AdminConfig, confirm?: () => Promise<boolean>): ConfigBlockState<D> {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState(() => spec.fromConfig(config));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<BlockStatus>('idle');
  const busy = useRef(false);
  const patch = spec.patchOf(draft, config);
  const dirty = Object.keys(patch).length > 0;

  const update = (next: (d: D) => D, clear?: string | 'all') => {
    setDraft(next);
    setStatus((s) => (s === 'saved' ? 'idle' : s));
    setErrors(({ form: _form, ...rest }) => {
      if (clear === 'all') return {};
      if (clear) delete rest[clear];
      return rest;
    });
  };

  const save = async () => {
    if (!dirty || busy.current) return;
    const invalid = spec.validate(draft);
    setErrors(invalid);
    if (Object.keys(invalid).length > 0) return;
    busy.current = true;
    try {
      if (confirm && !(await confirm())) return;
      setStatus('saving');
      const next = await saveConfig(patch, csrfToken);
      qc.setQueryData(CONFIG_KEY, next);
      void qc.invalidateQueries({ queryKey: ['public-config'] });
      void qc.invalidateQueries({ queryKey: ['audit'] });
      setDraft(spec.fromConfig(next));
      setStatus('saved');
      toast.show({ text: t('config.page.saved', { block: t(`config.${spec.block}.title`) }), tone: 'ok' });
    } catch (e) {
      setErrors(spec.errorOf(configErrorField(e), draft));
      setStatus('idle');
    } finally {
      busy.current = false;
    }
  };

  const cancel = () => {
    setDraft(spec.fromConfig(config));
    setErrors({});
    setStatus('idle');
  };

  return { draft, errors, status, dirty, update, save, cancel };
}
