import { useState } from 'react';
import type { FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { vnDeadlineDay } from '@/lib/format-time';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import { Dialog, DialogClose, DialogDescription, DialogTitle } from '@/ui/dialog';
import { Icon } from '@/ui/icon';
import { useToast } from '@/ui/toast-context';
import { userLabel, type DirectoryUser } from '@/features/directory/directory.api';
import { UserPicker } from '@/features/directory/user-picker';
import { useCurrentPeriod } from '@/features/request/request.api';
import { monthOf } from '@/features/request/request-format';
import { CreateRequestLines, type CreateLine } from './create-request-lines';
import { createFailure, type CreateErrors } from './summary-errors';
import { SUMMARY_KEY, createOnBehalf, useUnregistered } from './summary.api';

// Badge dẫn xuất từ danh sách chưa đăng ký của kỳ mở; server vẫn là nơi chặn trùng (REQUEST_EXISTS)
function useRegistrationBadge(enabled: boolean) {
  const { t } = useTranslation();
  const current = useCurrentPeriod();
  const unregistered = useUnregistered(enabled ? current.data?.ym : undefined);
  const subs = unregistered.data && new Set(unregistered.data.items.map((u) => u.sub));
  const badge = subs
    ? (u: DirectoryUser) =>
        subs.has(u.sub) ? (
          <span className="tag tag--warn">{t('summary.create.unregistered')}</span>
        ) : (
          <span className="tag">{t('summary.create.hasRequest')}</span>
        )
    : undefined;
  const deadline = current.data && `${vnDeadlineDay(current.data.deadline)}/${monthOf(current.data.ym)}`;
  return { badge, deadline };
}

function ExistsBlock({ name, month, requestId, onOpen }: { name: string; month: number; requestId?: string; onOpen: (id: string) => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="alert alert--warn aj-block">
      <span>{t('summary.create.exists', { name, month })}</span>
      {requestId && (
        <button type="button" className="btn btn--sm" onClick={() => onOpen(requestId)}>
          {t('summary.create.openAdjust')}
        </button>
      )}
    </div>
  );
}

// Tạo hộ theo luật member (api on_behalf): món chỉ Hành chính không chọn được ở đây
export function CreateRequestDialog({ ym, lockedOn, initialUser = null, onClose, onCreated, onOpenExisting }: {
  ym: string;
  lockedOn?: string;
  initialUser?: DirectoryUser | null;
  onClose: () => void;
  onCreated: () => void;
  onOpenExisting: (requestId: string) => void;
}) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const flight = useSingleFlight();
  const [user, setUser] = useState<DirectoryUser | null>(initialUser);
  const [lines, setLines] = useState<CreateLine[]>([]);
  const [errors, setErrors] = useState<CreateErrors>({});
  const locked = lockedOn !== undefined;
  const { badge, deadline } = useRegistrationBadge(!locked);
  const month = monthOf(ym);

  const send = async (who: DirectoryUser) => {
    setErrors({});
    try {
      await createOnBehalf({ user_sub: who.sub, lines }, csrfToken);
      void qc.invalidateQueries({ queryKey: SUMMARY_KEY });
      toast.show({ text: t('summary.create.created', { name: userLabel(who) }), tone: 'ok' });
      onCreated();
    } catch (err) {
      setErrors(createFailure(err, lines.map((l) => l.item_id), t));
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (locked) return;
    // Báo sớm cái còn thiếu; server vẫn chặn bằng LINES_EMPTY/VALIDATION
    if (!user || lines.length === 0) {
      setErrors({
        user: user ? undefined : t('summary.create.needUser'),
        linesMissing: lines.length ? undefined : t('summary.create.needLines'),
      });
      return;
    }
    void flight.run(() => send(user));
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} dirty={!!user || lines.length > 0} dismissible={!flight.pending} maxWidth={520}>
      <form onSubmit={submit} noValidate>
        <div className="sheet-header">
          <DialogTitle className="sheet-title">{t('summary.create.title', { month, year: ym.slice(0, 4) })}</DialogTitle>
          <DialogClose asChild>
            <button type="button" className="sheet-close" aria-label={t('common.close')} disabled={flight.pending}>
              <Icon name="x" />
            </button>
          </DialogClose>
        </div>
        <div className="sheet-body">
          <DialogDescription className="sm-note">{t('summary.create.description')}</DialogDescription>
          {locked && <p className="alert alert--warn">{t('summary.create.locked', { month, date: lockedOn })}</p>}
          {errors.exists && user && <ExistsBlock name={userLabel(user)} month={month} requestId={errors.exists.requestId} onOpen={onOpenExisting} />}
          {errors.block && (
            <p role="alert" className="alert alert--danger">
              {errors.block}
            </p>
          )}
          <UserPicker
            label={t('summary.create.person')}
            searchLabel={t('summary.create.personSearch')}
            value={user}
            excludeAdmin
            required
            badge={badge}
            error={errors.user}
            onChange={(u) => {
              setUser(u);
              setErrors({});
            }}
          />
          <CreateRequestLines
            lines={lines}
            errors={errors.lines}
            missing={errors.linesMissing}
            onChange={(next) => {
              setLines(next);
              setErrors((x) => ({ ...x, lines: undefined, linesMissing: undefined }));
            }}
          />
          {user && deadline && !locked && <p className="sm-note">{t('summary.create.rule', { name: userLabel(user), date: deadline })}</p>}
        </div>
        <div className="sheet-footer">
          <DialogClose asChild>
            <button type="button" className="btn btn--ghost" disabled={flight.pending}>
              {t('common.cancel')}
            </button>
          </DialogClose>
          <button type="submit" className="btn btn--primary" disabled={locked || flight.pending}>
            {flight.pending ? t('summary.create.saving') : t('summary.create.submit')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
