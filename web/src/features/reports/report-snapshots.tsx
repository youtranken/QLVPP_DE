import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { formatVnStamp } from "@/lib/format-time";
import { Icon } from "@/ui/icon";
import { LoadError } from "@/ui/load-state";
import { printPath, useSnapshots, type SnapshotRow } from "./reports.api";
import type { SnapshotDownload } from "./use-snapshot";

function SnapshotRowView({
  snapshot: s,
  latest,
  files,
}: {
  snapshot: SnapshotRow;
  latest: boolean;
  files: SnapshotDownload;
}) {
  const { t } = useTranslation();
  const at = formatVnStamp(s.created_at);
  return (
    <tr>
      <td className="num" data-label={t("reports.snapshots.colAt")}>{formatVnStamp(s.created_at, true)}</td>
      <td data-label={t("reports.snapshots.colKind")}>
        {t(`reports.snapshots.kind.${s.kind}`)}
        {s.has_items === false && (
          <span className="tag"> {t("reports.snapshots.empty")}</span>
        )}
      </td>
      <td className="num r" data-label={t("reports.snapshots.colItems")}>{s.items_count ?? "—"}</td>
      <td className="num r" data-label={t("reports.snapshots.colUnits")}>{s.units_total ?? "—"}</td>
      <td data-label={latest ? t("reports.snapshots.colSent") : ""}>
        {latest && (
          <span className="tag tag--ok">
            {t("reports.snapshots.sentLabel")}
          </span>
        )}
      </td>
      <td className="r" data-label="">
        {s.kind === "xlsx" ? (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            aria-label={t("reports.snapshots.download", { at })}
            disabled={files.pending}
            onClick={() => void files.run(s.id)}
          >
            <Icon name="download" size={18} />
            {t("reports.snapshots.reload")}
          </button>
        ) : (
          <Link
            className="btn btn--ghost btn--sm"
            to={printPath(s.id)}
            aria-label={t("reports.snapshots.reprint", { at })}
          >
            <Icon name="printer" size={18} />
            {t("reports.snapshots.reprintShort")}
          </Link>
        )}
      </td>
    </tr>
  );
}

function DownloadFailure({ files }: { files: SnapshotDownload }) {
  const { t } = useTranslation();
  const failure = files.failure;
  if (!failure) return null;
  return (
    <div role="alert" className="alert alert--danger bc-snap-error">
      <Icon name="alert" size={18} />
      <span>{t(`reports.snapshots.error.${failure.error}`)}</span>
      {failure.error === "DOWNLOAD_FAILED" && (
        <button
          type="button"
          className="btn btn--sm"
          disabled={files.pending}
          onClick={() => void files.run(failure.id)}
        >
          {t("reports.snapshots.retry")}
        </button>
      )}
    </div>
  );
}

// Gập sẵn: bản đã in/xuất để đối chiếu với ADM; bản mới nhất có hàng là bản đã gửi
export function ReportSnapshots({
  ym,
  files,
}: {
  ym: string;
  files: SnapshotDownload;
}) {
  const { t } = useTranslation();
  const id = useId();
  const query = useSnapshots(ym);
  const items = query.data?.items ?? [];
  const sentId = items.find((s) => s.has_items !== false)?.id;
  return (
    <details className="bc-snaps-box disclosure">
      <summary>
        {t("reports.snapshots.title", {
          n: query.isSuccess ? items.length : "…",
        })}
      </summary>
      <p className="bc-section__note" id={id}>
        {t("reports.snapshots.note")}
      </p>
      <DownloadFailure files={files} />
      {query.isError && <LoadError onRetry={() => void query.refetch()} />}
      {query.isSuccess && items.length === 0 && (
        <p className="bc-empty">{t("reports.snapshots.none")}</p>
      )}
      {items.length > 0 && (
        <div className="bc-scroll">
          {/* Cột cố định: đổi tháng (số món, đơn vị khác độ dài) thì cột không dời */}
          <table className="table table-stack grid-table bc-table table--fixed" aria-describedby={id}>
            <colgroup>
              <col />
              <col style={{ width: "9rem" }} />
              <col style={{ width: "4.5rem" }} />
              <col style={{ width: "4.5rem" }} />
              <col style={{ width: "12rem" }} />
              <col style={{ width: "8rem" }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">{t("reports.snapshots.colAt")}</th>
                <th scope="col">{t("reports.snapshots.colKind")}</th>
                <th scope="col" className="num r">
                  {t("reports.snapshots.colItems")}
                </th>
                <th scope="col" className="num r">
                  {t("reports.snapshots.colUnits")}
                </th>
                <th scope="col">
                  <span className="sr-only">
                    {t("reports.snapshots.colSent")}
                  </span>
                </th>
                <th scope="col">
                  <span className="sr-only">{t("summary.table.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <SnapshotRowView
                  key={s.id}
                  snapshot={s}
                  latest={s.id === sentId}
                  files={files}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}
