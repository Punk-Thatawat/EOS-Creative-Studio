"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Check, ChevronLeft, ChevronRight, CircleCheck, Copy, ImageIcon, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listAdminWithdrawals, reviewAdminWithdrawal, type AdminWithdrawal, type WithdrawalStatus } from "@/lib/api/affiliate";

const PAGE_SIZE = 25;
const numberFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateTimeFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

type Filter = WithdrawalStatus | "all";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "pending", label: "Waiting" },
  { value: "paid", label: "Paid" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

const STATUS_STYLE: Record<WithdrawalStatus, string> = {
  pending: "bg-[#fff4d6] text-[#8a5a00]",
  paid: "bg-[#e4f4e9] text-[#2f7d46]",
  rejected: "bg-[#fde8e1] text-[#b8481f]",
  cancelled: "bg-[#efeceb] text-[#736b65]",
};
const STATUS_LABEL: Record<WithdrawalStatus, string> = { pending: "Waiting", paid: "Paid", rejected: "Rejected", cancelled: "Cancelled" };

/** What an admin needs to make the transfer: the account the money goes to. */
function destinationLines(item: AdminWithdrawal): { label: string; value: string }[] {
  if (item.method === "promptpay") return [{ label: "PromptPay", value: item.promptpayId ?? "" }];
  return [
    { label: item.bankName ?? "Bank", value: item.bankAccountNumber ?? "" },
  ];
}

type Acting = { id: string; kind: "pay" | "reject" } | null;

/**
 * The queue of withdrawal requests. An admin makes the transfer outside the system, then marks the request paid (the server
 * makes the transfer reference, and a dialog shows it) or rejects it with a reason the member sees, which gives the baht
 * back to them.
 */
export function WithdrawalsSection() {
  const [filter, setFilter] = useState<Filter>("pending");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdminWithdrawal[]>([]);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingBaht, setPendingBaht] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<Acting>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  /** The request that was just marked paid, shown in the success dialog until it is closed. */
  const [paid, setPaid] = useState<AdminWithdrawal | null>(null);

  const reload = useCallback(async () => {
    try {
      const result = await listAdminWithdrawals({ status: filter, page, limit: PAGE_SIZE });
      setItems(result.withdrawals);
      setTotal(result.total);
      setPendingCount(result.pendingCount);
      setPendingBaht(result.pendingBaht);
      setError(null);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Could not load the withdrawals");
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    let active = true;
    void listAdminWithdrawals({ status: filter, page, limit: PAGE_SIZE })
      .then((result) => {
        if (!active) return;
        setItems(result.withdrawals);
        setTotal(result.total);
        setPendingCount(result.pendingCount);
        setPendingBaht(result.pendingBaht);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load the withdrawals");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filter, page]);

  function changeFilter(next: Filter) {
    if (next === filter) return;
    setLoading(true);
    setPage(1);
    setFilter(next);
    setActing(null);
  }

  function openAction(id: string, kind: "pay" | "reject") {
    setActing({ id, kind });
    setText("");
    setError(null);
  }

  async function confirm() {
    if (!acting) return;
    const note = text.trim();
    if (acting.kind === "reject" && !note) return;
    setBusy(true);
    setError(null);
    try {
      // Paying sends no reference: the server makes one, and it comes back with the request.
      const result = await reviewAdminWithdrawal(acting.id, acting.kind === "pay" ? { action: "pay" } : { action: "reject", note });
      if (acting.kind === "pay") setPaid(result);
      setActing(null);
      setText("");
      await reload();
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : "";
      setError(message === "already_reviewed" ? "This request was already paid or rejected. The list has been refreshed." : message || "Could not update the request");
      if (message === "already_reviewed") {
        setActing(null);
        await reload();
      }
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1500);
    } catch {
      // The value stays selectable in the table if the browser refuses clipboard access.
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="mt-5 rounded-2xl border border-border bg-white p-4 sm:p-5" aria-labelledby="affiliate-withdrawals-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="affiliate-withdrawals-heading" className="text-sm font-bold">Withdrawal requests</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Transfer the money yourself, then mark the request paid. Rejecting needs a reason, which the member sees, and gives the baht back to them.
          </p>
        </div>
        <div className="rounded-xl border border-[#f2b49b] bg-[#fff8f3] px-3 py-2 text-xs">
          <span className="text-muted-foreground">Waiting to be paid</span>
          <div className="mt-0.5 text-sm font-extrabold text-[#b8481f]">
            ฿{numberFormat.format(pendingBaht)} <span className="text-xs font-semibold">· {pendingCount} {pendingCount === 1 ? "request" : "requests"}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Withdrawal status">
        {FILTERS.map((entry) => (
          <Button key={entry.value} type="button" size="sm" role="tab" aria-selected={filter === entry.value} variant={filter === entry.value ? "default" : "outline"} onClick={() => changeFilter(entry.value)}>
            {entry.label}
          </Button>
        ))}
      </div>

      {error ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#f2b49b] bg-[#fff8f3] px-3 py-2 text-xs text-[#b8481f]" role="alert">
          <AlertCircle size={14} /> {error}
        </div>
      ) : null}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="py-2 pr-3 font-semibold">Requested</th>
              <th className="py-2 pr-3 font-semibold">Member</th>
              <th className="py-2 pr-3 text-right font-semibold">Amount (฿)</th>
              <th className="py-2 pr-3 font-semibold">Send to</th>
              <th className="py-2 pr-3 font-semibold">Status</th>
              <th className="py-2 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No requests here.</td></tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-border/60 align-top">
                  <td className="py-2.5 pr-3 whitespace-nowrap">{dateTimeFormat.format(new Date(item.createdAt))}</td>
                  <td className="py-2.5 pr-3">
                    <div className="font-semibold">{item.displayName || item.email || "—"}</div>
                    <div className="text-muted-foreground">{item.email} · {item.code}</div>
                  </td>
                  <td className="py-2.5 pr-3 text-right font-bold tabular-nums">
                    <span>{numberFormat.format(item.amountBaht)}</span>
                    <button type="button" className="ml-1.5 align-middle text-muted-foreground hover:text-foreground" aria-label="Copy amount" onClick={() => { void copy(item.amountBaht.toFixed(2), `${item.id}-amount`); }}>
                      {copied === `${item.id}-amount` ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </td>
                  <td className="py-2.5 pr-3">
                    {destinationLines(item).map((line) => (
                      <div key={line.label} className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">{line.label}</span>
                        <span className="font-mono font-semibold">{line.value}</span>
                        <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={`Copy ${line.label} number`} onClick={() => { void copy(line.value, `${item.id}-dest`); }}>
                          {copied === `${item.id}-dest` ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </div>
                    ))}
                    <div>{item.accountName}</div>
                    {item.contactEmail ? (
                      <a className="text-muted-foreground hover:underline" href={`mailto:${item.contactEmail}`}>{item.contactEmail}</a>
                    ) : null}
                    {item.proofUrl ? (
                      <a className="mt-1 inline-flex items-center gap-1 font-semibold text-primary hover:underline" href={item.proofUrl} target="_blank" rel="noopener noreferrer">
                        <ImageIcon size={13} /> ID proof
                      </a>
                    ) : (
                      <div className="mt-1 text-muted-foreground">No ID proof</div>
                    )}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[item.status]}`}>{STATUS_LABEL[item.status]}</span>
                    {item.reviewedAt ? <div className="mt-1 text-muted-foreground">{dateTimeFormat.format(new Date(item.reviewedAt))}</div> : null}
                    {item.reference ? <div className="text-muted-foreground">Ref {item.reference}</div> : null}
                    {item.status === "rejected" && item.note ? <div className="text-[#b8481f]">{item.note}</div> : null}
                  </td>
                  <td className="py-2.5 text-right">
                    {item.status === "pending" ? (
                      acting?.id === item.id ? (
                        <div className="ml-auto grid w-60 gap-1.5 text-left">
                          {acting.kind === "pay" ? (
                            <p className="font-semibold">
                              Have you transferred ฿{numberFormat.format(item.amountBaht)}?
                              <span className="mt-0.5 block font-normal text-muted-foreground">The transfer reference is created automatically.</span>
                            </p>
                          ) : (
                            <label className="grid gap-1 font-semibold">
                              Reason for the member
                              <input
                                className="h-8 rounded-lg border border-border bg-white px-2 text-xs font-normal"
                                value={text}
                                maxLength={300}
                                onChange={(event) => setText(event.target.value)}
                                autoFocus
                              />
                            </label>
                          )}
                          <div className="flex gap-1.5">
                            <Button type="button" size="sm" disabled={busy || (acting.kind === "reject" && !text.trim())} onClick={() => { void confirm(); }}>
                              {busy ? <LoaderCircle size={13} className="animate-spin" /> : null}
                              {acting.kind === "pay" ? "Confirm paid" : "Confirm reject"}
                            </Button>
                            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setActing(null)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1.5">
                          <Button type="button" size="sm" onClick={() => openAction(item.id, "pay")}>Mark paid</Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => openAction(item.id, "reject")}>Reject</Button>
                        </div>
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <nav className="mt-3 flex items-center justify-between gap-3 text-xs" aria-label="Withdrawal pages">
        <span className="text-muted-foreground">{total} {total === 1 ? "request" : "requests"}</span>
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="sm" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage(page - 1); }}>
            <ChevronLeft size={14} />
          </Button>
          <span className="px-2 text-muted-foreground">Page {page} of {pages}</span>
          <Button type="button" variant="outline" size="sm" aria-label="Next page" disabled={page >= pages || loading} onClick={() => { setLoading(true); setPage(page + 1); }}>
            <ChevronRight size={14} />
          </Button>
        </div>
      </nav>

      <Dialog open={paid !== null} onOpenChange={(open) => { if (!open) setPaid(null); }}>
        <DialogContent className="max-w-sm">
          {paid ? (
            <>
              <DialogHeader className="items-center pr-5 text-center">
                <span className="grid size-12 place-items-center rounded-full bg-[#e4f4e9] text-[#2f7d46]" aria-hidden="true"><CircleCheck size={26} /></span>
                <DialogTitle className="mt-2 text-lg">Transfer successful</DialogTitle>
                <DialogDescription>
                  ฿{numberFormat.format(paid.amountBaht)} to {paid.accountName} is marked as paid. The member is told by email.
                </DialogDescription>
              </DialogHeader>
              <DialogBody>
                <dl className="grid gap-2 rounded-xl border border-border bg-[#fcfaf8] p-3 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Member</dt>
                    <dd className="truncate font-semibold">{paid.email || paid.displayName || "—"}</dd>
                  </div>
                  {destinationLines(paid).map((line) => (
                    <div key={line.label} className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">{line.label}</dt>
                      <dd className="font-mono font-semibold">{line.value}</dd>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Transfer reference</dt>
                    <dd className="flex items-center gap-1.5 font-mono font-bold">
                      {paid.reference || "—"}
                      {paid.reference ? (
                        <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Copy transfer reference" onClick={() => { void copy(paid.reference ?? "", `${paid.id}-ref`); }}>
                          {copied === `${paid.id}-ref` ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      ) : null}
                    </dd>
                  </div>
                </dl>
              </DialogBody>
              <DialogFooter>
                <DialogClose render={<Button type="button" />}>Done</DialogClose>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
