import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import { Dialog, DialogClose, DialogDescription, DialogTitle } from '@/ui/dialog';
import { useToast } from '@/ui/toast-context';
import { useRequestFormat } from '@/features/request/request-format';
import { AdjustDialog } from '@/features/summary/adjust-dialog';
import { lineErrorText } from '../delivery-errors';
import type { DeliveryPerson, DeliveryPersonLine } from './delivery-people.api';
import { dialogRows, limitsOf, priorityFor, stepsOf, stockShortages, totalsOf, type Totals } from './deliver-plan';
import { DeliverRows } from './deliver-dialog-rows';
import { NETWORK, NOT_SENT, sendSteps, type SendResult, type SentLine } from './deliver-send';
import { waitingIndex } from './people-filter';
import { useAskThenSubmit } from './use-ask-reject';
import { REJECT_SKIPPED } from './with-rejects';
import { useRefreshAfterLineChange } from './use-refresh-after-flow';
import { useDisabledReason } from '@/ui/disabled-reason';

export interface DeliverDialogProps {
  person: DeliveryPerson;
  people: DeliveryPerson[];
  // Mở từ panel: số panel đang chọn thay cho số đề xuất
  initial?: Record<string, number>;
  next?: DeliveryPerson;
  onNext?: (sub: string) => void;
  onClose: () => void;
  onDone: () => void;
  onOpenPerson: () => void;
  // Giao xong đặt focus ở đâu (ô tìm tên); trả false thì focus về nút mở
  focusAfter?: () => boolean;
}

const NO_WAIT = { people: 0, qty: 0 };

function sumText(s: Totals, t: (k: string, o?: Record<string, unknown>) => string) {
  const base = s.left === 0 && s.debt === 0 ? t('delivery.confirm.sumAll', { give: s.give }) : t('delivery.confirm.sumOwe', { give: s.give, left: s.left });
  const debt = s.debt > 0 ? t('delivery.confirm.sumDebt', { debt: s.debt }) : '';
  const cancel = s.cancel > 0 ? ` · ${t('delivery.confirm.sumCancel', { n: s.cancel })}` : '';
  return `${base}${debt}${cancel}`;
}

function Results({ result, lineOf }: { result: SendResult | null; lineOf: (id: string) => DeliveryPersonLine | undefined }) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const text = ({ lineId, outcome: o }: SentLine) => {
    if (o.ok) return o.kind === 'delivered' ? t('delivery.confirm.done', { n: o.qty }) : o.kind === 'rejected' ? t('delivery.confirm.rejected') : t('delivery.confirm.cancelledAdm');
    if (o.code === NOT_SENT) return t('delivery.confirm.notSent');
    if (o.code === REJECT_SKIPPED) return t('delivery.confirm.rejectSkipped');
    if (o.code === NETWORK) return t('delivery.confirm.network');
    return lineErrorText(o, fmt.unit(lineOf(lineId)?.unit ?? null), t);
  };
  return (
    <div role="status" aria-live="polite" className="dd-results">
      {result && (
        <ul>
          {result.lines.map((s, i) => (
            <li key={`${s.lineId}-${i}`} className={s.outcome.ok ? 'is-ok' : 'is-err'}>
              <span aria-hidden="true">{s.outcome.ok ? '✓' : '✗'}</span>
              <b>{fmt.name(lineOf(s.lineId) ?? { name: '', name_en: null })}</b>
              <span>{text(s)}</span>
            </li>
          ))}
        </ul>
      )}
      {result?.expired && <p className="dd-expired">{t('delivery.confirm.sessionExpired')}</p>}
    </div>
  );
}

export function DeliverDialog({ person, people, initial, next, onNext, onClose, onDone, onOpenPerson, focusAfter }: DeliverDialogProps) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const toast = useToast();
  const refresh = useRefreshAfterLineChange([['admin-request']]);
  const flight = useSingleFlight();
  const sumId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const succeeded = useRef(false);
  // Tủ và phần còn lại chụp lúc mở: số đang hiện là số gửi đi, server mới là chuẩn
  const snapOf = () => ({
    rows: dialogRows(person, priorityFor(person, people)),
    shortages: stockShortages(people),
    waiting: waitingIndex(people),
  });
  const [snap, setSnap] = useState(snapOf);
  // Lưu điều chỉnh xong → lần nạp danh sách người kế tiếp là số mới, chụp lại đúng lần đó; hủy thì không chụp lại
  const [adjusting, setAdjusting] = useState(false);
  const resnap = useRef(false);
  // Nạp lại trả y dữ liệu cũ thì person/people giữ tham chiếu: lượt đếm này vẫn kích chụp lại và tắt cờ
  const [refreshed, setRefreshed] = useState(0);
  useEffect(() => {
    if (!resnap.current) return;
    resnap.current = false;
    setSnap(snapOf());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person, people, refreshed]);
  const [values, setValues] = useState<Record<string, number>>(initial ?? {});
  const [result, setResult] = useState<SendResult | null>(null);
  // Món ngoài danh mục chờ duyệt đang hiện trong hộp: giao sẽ ghi Không mua đúng các món này, phải hỏi lại trước
  const pending = snap.rows.filter((r) => r.reason === 'review').map((r) => r.line);
  const limits = useMemo(() => limitsOf(snap.rows, values), [snap.rows, values]);
  const totals = totalsOf(snap.rows, limits);
  const name = person.full_name ?? person.user_sub;
  const sending = flight.pending;
  const canSend = totals.give > 0 || totals.cancel > 0;
  const noQty = useDisabledReason(canSend ? null : t('common.disabledReason.noQty'));
  const lineOf = (id: string) => person.lines.find((l) => l.line_id === id);

  const submit = () =>
    flight.run(async () => {
      const sent = await sendSteps(stepsOf(snap.rows, limits), csrfToken, pending);
      await refresh();
      if (sent.expired || sent.lines.some((s) => !s.outcome.ok)) return setResult(sent);
      succeeded.current = true;
      toast.show({
        text: t('delivery.people.panel.delivered', { name }),
        action: next && onNext ? { label: t('delivery.people.panel.next'), onClick: () => onNext(next.user_sub) } : undefined,
      });
      onDone();
    });
  const ask = useAskThenSubmit(pending, t('delivery.confirm.title', { name }), () => void submit());

  // Enter giữ lâu lặp keydown: chỉ một lần nhấn mới được tính
  const blockRepeat = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.repeat) e.preventDefault();
  };

  // Điều chỉnh mở thì hộp Giao ẩn (vẫn giữ trạng thái): hai lớp modal chồng nhau thì panel Điều chỉnh nằm sau, không bấm được
  return (
    <>
      <Dialog
        open={!adjusting}
        onOpenChange={(o) => !o && onClose()}
        dismissible={!sending}
        className="sheet a-form dd-sheet"
        maxWidth={720}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          titleRef.current?.focus();
        }}
        onCloseFocus={() => succeeded.current && (focusAfter?.() ?? false)}
      >
        <div className="sheet-header">
          <div>
            <DialogTitle ref={titleRef} tabIndex={-1} className="sheet-title">
              {t('delivery.confirm.title', { name })}
            </DialogTitle>
            <DialogDescription className="dd-sub">
              <span>{person.department ?? t('delivery.people.card.noDepartment')}</span>
              {person.user_status !== 'active' && <span className="dd-leftuser">{t('delivery.confirm.leftUser')}</span>}
            </DialogDescription>
          </div>
        </div>
        <div className="sheet-body">
          {!result && (
            <>
              <DeliverRows
                rows={snap.rows}
                limits={limits}
                disabled={sending}
                waiting={(l) => (l.item_id ? snap.waiting(l.item_id, person.user_sub) : NO_WAIT)}
                shortage={(l) => (l.item_id ? snap.shortages.get(l.item_id) : undefined)}
                onChange={(id, n) => setValues((v) => ({ ...v, [id]: n }))}
              />
              <p id={sumId} className="dd-sum num">
                {sumText(totals, t)}
              </p>
              <p className="dd-note">{t('delivery.confirm.noUndo')}</p>
            </>
          )}
          <Results result={result} lineOf={lineOf} />
        </div>
        <div className="sheet-footer">
          {result ? (
            <>
              <button type="button" className="btn btn--ghost" onClick={onOpenPerson}>
                {t('delivery.confirm.openPerson')}
              </button>
              <DialogClose asChild>
                <button type="button" className="btn btn--primary">
                  {t('delivery.confirm.close')}
                </button>
              </DialogClose>
            </>
          ) : (
            <>
              {person.request_id && (
                <button
                  type="button"
                  className="btn btn--ghost dd-adjust"
                  disabled={sending}
                  onClick={() => setAdjusting(true)}
                >
                  {t('delivery.confirm.adjust')}
                </button>
              )}
              <DialogClose asChild>
                <button type="button" className="btn btn--ghost" disabled={sending}>
                  {t('delivery.confirm.cancel')}
                </button>
              </DialogClose>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!canSend || sending}
                aria-busy={sending}
                aria-describedby={[sumId, noQty.describedBy].filter(Boolean).join(' ')}
                onKeyDown={blockRepeat}
                onClick={ask}
              >
                {sending ? t('delivery.confirm.sending') : t('delivery.confirm.ok')}
              </button>
              {noQty.node}
            </>
          )}
        </div>
      </Dialog>
      {adjusting && person.request_id && <AdjustDialog requestId={person.request_id} onSaved={(done) => {
            resnap.current = true;
            // React Query báo dữ liệu mới cho component qua setTimeout 0 sau khi nạp xong → đếm sau lượt báo đó
            void done.finally(() => setTimeout(() => setRefreshed((n) => n + 1), 0));
          }} onClose={() => setAdjusting(false)} />}
    </>
  );
}
