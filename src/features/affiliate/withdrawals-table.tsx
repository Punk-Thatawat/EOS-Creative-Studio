"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AffiliateWithdrawal, WithdrawalStatus } from "@/lib/api/affiliate";
import { useLocale } from "@/lib/i18n/locale-provider";
import { formatDate, formatNumber } from "./format";
import styles from "./affiliate-page.module.css";

const PAGE_SIZE = 10;

type SortKey = "date" | "destination" | "name" | "email" | "amount" | "status";
type SortOrder = "asc" | "desc";

/** The order statuses are sorted in: what still needs attention first. */
const STATUS_RANK: Record<WithdrawalStatus, number> = { pending: 0, paid: 1, rejected: 2, cancelled: 3 };

function compare(a: AffiliateWithdrawal, b: AffiliateWithdrawal, key: SortKey): number {
  switch (key) {
    case "date":
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    case "amount":
      return a.amountBaht - b.amountBaht;
    case "status":
      return STATUS_RANK[a.status] - STATUS_RANK[b.status];
    case "destination":
      return a.destination.localeCompare(b.destination);
    case "name":
      return a.accountName.localeCompare(b.accountName);
    case "email":
      return (a.contactEmail ?? "").localeCompare(b.contactEmail ?? "");
  }
}

/**
 * The member's withdrawals as a table. A click on a heading sorts by that column (text from A, numbers and dates from the
 * most and the newest), a second click turns it round. More than a page of rows is split into pages.
 */
export function WithdrawalsTable({
  items,
  cancelingId,
  onCancel,
}: {
  items: AffiliateWithdrawal[];
  cancelingId: string | null;
  onCancel: (id: string) => void;
}) {
  const { locale, t } = useLocale();
  // No column chosen is the starting order, newest first. A column goes through two orders and then back to this one.
  const [chosen, setChosen] = useState<{ key: SortKey; order: SortOrder } | null>(null);
  const sort: SortKey = chosen?.key ?? "date";
  const order: SortOrder = chosen?.order ?? "desc";
  const [page, setPage] = useState(1);

  const statusLabel = {
    pending: t("affiliate.withdraw.statusPending"),
    paid: t("affiliate.withdraw.statusPaid"),
    rejected: t("affiliate.withdraw.statusRejected"),
    cancelled: t("affiliate.withdraw.statusCancelled"),
  } as const;
  const badge = {
    pending: styles.badgePending,
    paid: styles.badgePaid,
    rejected: styles.badgeRejected,
    cancelled: styles.badgeCancelled,
  } as const;

  const sorted = useMemo(() => {
    const direction = order === "asc" ? 1 : -1;
    // Rows that compare equal keep newest first, so the order never jumps about between clicks.
    return [...items].sort((a, b) => compare(a, b, sort) * direction || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [items, sort, order]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  /** Text and status start from A, numbers and dates from the most and the newest. */
  const firstOrder = (key: SortKey): SortOrder => (key === "destination" || key === "name" || key === "email" || key === "status" ? "asc" : "desc");

  // First click: the column's own order. Second click: the other way round. Third click: back to the starting order.
  function sortBy(key: SortKey) {
    setPage(1);
    if (chosen?.key !== key) {
      setChosen({ key, order: firstOrder(key) });
    } else if (chosen.order === firstOrder(key)) {
      setChosen({ key, order: firstOrder(key) === "asc" ? "desc" : "asc" });
    } else {
      setChosen(null);
    }
  }

  const columns: { key: SortKey; label: string; numeric?: boolean }[] = [
    { key: "date", label: t("affiliate.withdraw.colDate") },
    { key: "destination", label: t("affiliate.withdraw.colDestination") },
    { key: "name", label: t("affiliate.withdraw.colName") },
    { key: "email", label: t("affiliate.withdraw.colEmail") },
    { key: "amount", label: t("affiliate.withdraw.colAmount"), numeric: true },
    { key: "status", label: t("affiliate.withdraw.colStatus") },
  ];

  return (
    <>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((column) => {
                const active = chosen?.key === column.key;
                const Icon = !active ? ArrowUpDown : order === "asc" ? ArrowUp : ArrowDown;
                return (
                  <th key={column.key} scope="col" className={column.numeric ? styles.num : undefined} aria-sort={active ? (order === "asc" ? "ascending" : "descending") : "none"}>
                    <button type="button" className={`${styles.sortButton} ${active ? styles.sortActive : ""}`} onClick={() => sortBy(column.key)}>
                      {column.label}
                      <Icon size={12} aria-hidden="true" />
                    </button>
                  </th>
                );
              })}
              <th scope="col" className={styles.num}>{t("affiliate.withdraw.colAction")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => (
              <tr key={item.id}>
                <td className={styles.nowrap}>{formatDate(item.createdAt, locale)}</td>
                <td className={styles.mono}>{item.destination}</td>
                <td>{item.accountName}</td>
                <td className={styles.nowrap}>{item.contactEmail ?? "—"}</td>
                <td className={`${styles.num} ${styles.amountCell}`}>{formatNumber(item.amountBaht, locale)}</td>
                <td>
                  <span className={`${styles.badge} ${badge[item.status]}`}>{statusLabel[item.status]}</span>
                  {item.status === "rejected" && item.note ? <div className={styles.reason}>{t("affiliate.withdraw.reason", { note: item.note })}</div> : null}
                </td>
                <td className={styles.num}>
                  {item.status === "pending" ? (
                    <Button type="button" variant="outline" size="sm" disabled={cancelingId === item.id} onClick={() => onCancel(item.id)}>
                      {t("affiliate.withdraw.cancel")}
                    </Button>
                  ) : (
                    <span className={styles.dash}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 ? (
        <nav className={styles.tablePager} aria-label={t("affiliate.withdraw.historyTitle")}>
          <Button type="button" variant="outline" size="sm" aria-label={t("affiliate.withdraw.pagePrev")} disabled={current <= 1} onClick={() => setPage(current - 1)}>
            <ChevronLeft size={14} />
          </Button>
          <span>{t("affiliate.withdraw.pageOf", { page: current, pages })}</span>
          <Button type="button" variant="outline" size="sm" aria-label={t("affiliate.withdraw.pageNext")} disabled={current >= pages} onClick={() => setPage(current + 1)}>
            <ChevronRight size={14} />
          </Button>
        </nav>
      ) : null}
    </>
  );
}
