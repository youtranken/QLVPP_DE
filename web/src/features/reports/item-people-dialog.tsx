import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyValue } from '@/ui/empty-cell';
import { Dialog, DialogCloseButton, DialogTitle } from "@/ui/dialog";
import { Loading, LoadError } from "@/ui/load-state";
import { RegistrationDialog } from "@/features/summary/registration-dialog";
import { useRequestFormat } from "@/features/request/request-format";
import { useItemPeople, type ItemPerson } from "./use-item-people";

interface Props {
  ym: string;
  itemKey: string;
  // Số Đề nghị đang hiện ở bảng (có thể đã sửa, chưa lưu)
  order: number;
  onClose: () => void;
}

const nameOf = (p: ItemPerson) => p.full_name ?? p.email ?? p.user_sub;

function Note({ person }: { person: ItemPerson }) {
  const { t } = useTranslation();
  if (!person.reason_code) return <EmptyValue />;
  const reason = person.reason_note
    ? `${t(`adjustReason.${person.reason_code}`)}: ${person.reason_note}`
    : t(`adjustReason.${person.reason_code}`);
  return <>{t("reports.send.people.removed", { reason })}</>;
}

// "Ai đăng ký món": Hành chính xem số từng người và việc HC đã bỏ, mở phiếu của người đó như ở Kỳ tháng
export function ItemPeopleDialog({ ym, itemKey, order, onClose }: Props) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const query = useItemPeople(ym, itemKey);
  const [viewing, setViewing] = useState<string | null>(null);
  const data = query.data;
  const rows = data?.people ?? [];
  const index = rows.findIndex((p) => p.request_id === viewing);
  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()} maxWidth={640}>
        <div className="sheet-header">
          <div className="rg-head__text">
            <small>{t("reports.send.people.title")}</small>
            <DialogTitle className="sheet-title">
              {data?.name ?? ""}
            </DialogTitle>
            {data && (
              <small>
                {t("reports.send.people.subtitle", {
                  requested: data.requested,
                  unit: fmt.unit(data.unit),
                  after: data.after,
                  order,
                })}
              </small>
            )}
          </div>
          <DialogCloseButton />
        </div>
        <div className="sheet-body">
          {query.isError ? (
            <LoadError onRetry={() => void query.refetch()} />
          ) : !data ? (
            <Loading />
          ) : rows.length === 0 ? (
            <p className="bc-empty">{t("reports.send.people.empty")}</p>
          ) : (
            <div className="bc-scroll">
              <table className="table grid-table bc-table">
                <thead>
                  <tr>
                    <th scope="col">{t("summary.open.colPerson")}</th>
                    <th scope="col">{t("summary.open.colTeam")}</th>
                    <th scope="col" className="num r">
                      {t("reports.send.people.qty")}
                    </th>
                    <th scope="col">{t("summary.table.note")}</th>
                    <th scope="col">
                      <span className="sr-only">
                        {t("summary.table.actions")}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.request_id}>
                      <td>{nameOf(p)}</td>
                      <td>{p.team ?? t("common.empty")}</td>
                      <td className="num r">
                        {p.before !== null && p.before !== p.qty && (
                          <s className="sm-muted">{p.before}</s>
                        )}{" "}
                        {p.qty}
                      </td>
                      <td>
                        <Note person={p} />
                      </td>
                      <td className="r">
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          aria-label={t("summary.open.viewFor", {
                            name: nameOf(p),
                          })}
                          onClick={() => setViewing(p.request_id)}
                        >
                          {t("reports.send.people.view")}
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row" colSpan={2}>
                      {t("reports.send.people.total")}
                    </th>
                    <td className="num r">
                      <b>{data.after}</b>
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Dialog>
      {index >= 0 && (
        <RegistrationDialog
          ym={ym}
          deadline={null}
          rows={rows}
          index={index}
          onIndex={(i) => setViewing(rows[i]!.request_id)}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}
