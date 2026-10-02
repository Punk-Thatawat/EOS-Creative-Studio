"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Coins, LoaderCircle, Plus, RefreshCw, Send, ShieldCheck, UserPlus, UserRound, UsersRound, X } from "lucide-react";
import { SidebarNavigation } from "@/components/app-shell/navigation";
import { StudioHeader } from "@/components/app-shell/studio-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SidebarProvider } from "@/components/ui/sidebar";
import { grantAdminMemberCredits, resendAdminMemberInvitation, sendAdminMemberAssessment, inviteAdminMember, listAdminMembers, updateAdminMember, type AdminMember, type AdminMemberRole, type AdminMemberStatus, type InviteAdminMemberInput, type QuickPlaybookType } from "@/lib/api/admin-members";
import { useLocale } from "@/lib/i18n/locale-provider";

const permissionLabels: Record<string, string> = {
  create_content: "Create content",
  manage_own_assets: "Manage own assets",
  manage_own_history: "View own history",
  manage_members: "Manage members",
  manage_credits: "Manage credits",
  manage_admin_settings: "Manage admin settings",
};

const quickPlaybookOptions = [
  { value: "creator", label: "creator" },
  { value: "marketing", label: "marketing" },
  { value: "agency", label: "agency" },
  { value: "sme_owner", label: "smeOwner" },
  { value: "corporate", label: "corporate" },
  { value: "beginner", label: "beginner" },
  { value: "ai_power_user", label: "aiPowerUser" },
] as const satisfies { value: QuickPlaybookType; label: string }[];

function toggleQuickPlaybook(current: QuickPlaybookType[], playbook: QuickPlaybookType) {
  return current.includes(playbook) ? current.filter((item) => item !== playbook) : [...current, playbook];
}

function formatCredits(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(value);
}

function formatDate(value?: string) {
  if (!value) return "Never signed in";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

function initials(member: AdminMember) {
  const source = member.displayName?.trim() || member.email;
  return source.slice(0, 2).toUpperCase();
}

function RolePermissionCard({ role, title, description, permissions }: { role: AdminMemberRole; title: string; description: string; permissions: string[] }) {
  return <Card className="p-5"><div className="flex items-start gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${role === "admin" ? "bg-[#fff0e9] text-primary" : "bg-[#e8f3ed] text-[#347454]"}`}><ShieldCheck size={18} /></span><div><p className="text-sm font-bold">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div></div><div className="mt-4 flex flex-wrap gap-1.5">{permissions.map((permission) => <span key={permission} className="rounded-full bg-[#fcfaf8] px-2.5 py-1 text-[10px] font-semibold text-[#665d57]">{permission}</span>)}</div></Card>;
}

function CreditDialog({ member, busy, onClose, onSubmit }: { member: AdminMember; busy: boolean; onClose: () => void; onSubmit: (credits: number, reason: string) => void }) {
  const [credits, setCredits] = useState("");
  const [reason, setReason] = useState("");
  const amount = Number(credits);
  const valid = Number.isFinite(amount) && amount > 0 && amount <= 1000000;

  return <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
    <DialogContent className="max-w-md overflow-hidden rounded-3xl border-[#eaded6] bg-[#faf8f6]" showCloseButton={false}>
      <header className="flex items-start justify-between gap-4 border-b border-border bg-white px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">Credit adjustment</p><DialogTitle className="mt-1 text-xl tracking-tight">Add credits</DialogTitle><DialogDescription className="mt-1 text-xs">{member.displayName || member.email} · current balance {formatCredits(member.creditBalance)}</DialogDescription></div><DialogClose render={<button type="button" className="rounded-xl p-2 text-muted-foreground hover:bg-surface-muted" aria-label="Close add credits dialog" />}><X size={19} /></DialogClose></header>
      <form onSubmit={(event) => { event.preventDefault(); if (valid) onSubmit(amount, reason.trim()); }}>
        <div className="space-y-4 p-5"><label className="block text-xs font-semibold">Credits to add<input autoFocus type="number" min="0.0001" max="1000000" step="0.0001" value={credits} onChange={(event) => setCredits(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" placeholder="100" required /><span className="mt-1 block text-[10px] font-normal text-muted-foreground">This is a grant and will be recorded in the member’s credit transactions.</span></label><label className="block text-xs font-semibold">Reason <span className="font-normal text-muted-foreground">(optional)</span><input maxLength={240} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" placeholder="Customer support compensation" /></label></div>
        <footer className="flex justify-end gap-2 border-t border-border bg-white px-5 py-4"><Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" size="sm" disabled={!valid || busy}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Plus size={15} />} {busy ? "Adding…" : "Add credits"}</Button></footer>
      </form>
    </DialogContent>
  </Dialog>;
}

function AssessmentDialog({ member, sent, busy, error, onClose, onSubmit }: { member: AdminMember; sent: boolean; busy: boolean; error: string; onClose: () => void; onSubmit: () => void }) {
  const { t } = useLocale();
  const forms = (member.quickPlaybookTypes ?? (member.quickPlaybookType ? [member.quickPlaybookType] : [])).map((type) => {
    const option = quickPlaybookOptions.find((item) => item.value === type);
    return { type, label: option ? t(`admin.members.invite.quickPlaybook.${option.label}`) : type };
  });

  return <Dialog open onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
    <DialogContent className="max-w-md overflow-hidden rounded-3xl border-[#eaded6] bg-[#faf8f6]" showCloseButton={false}>
      <header className="flex items-start justify-between gap-4 border-b border-border bg-white px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">Member assessment</p><DialogTitle className="mt-1 text-xl tracking-tight">{sent ? "Send assessment again?" : "Confirm assessment email"}</DialogTitle><DialogDescription className="mt-1 text-xs">This email will be sent to {member.email} with the following forms:</DialogDescription></div><DialogClose render={<button type="button" className="rounded-xl p-2 text-muted-foreground hover:bg-surface-muted" aria-label="Close assessment confirmation" disabled={busy} />}><X size={19} /></DialogClose></header>
      <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
        <div className="space-y-3 p-5"><ul className="space-y-2">{forms.map((form) => <li key={form.type} className="flex items-center gap-2 rounded-xl border border-[#eaded6] bg-white px-3 py-2.5 text-sm font-semibold"><CheckCircle2 size={15} className="shrink-0 text-primary" />{form.label}</li>)}</ul>{error ? <p role="alert" className="rounded-xl border border-[#efc2c2] bg-[#fff6f6] px-3 py-2 text-xs text-[#9f3b3b]">{error}</p> : null}</div>
        <footer className="flex justify-end gap-2 border-t border-border bg-white px-5 py-4"><Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" size="sm" disabled={busy || !forms.length}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />} {busy ? "Sending…" : sent ? "Send again" : "Send assessment"}</Button></footer>
      </form>
    </DialogContent>
  </Dialog>;
}

function InviteDialog({ busy, onClose, onSubmit }: { busy: boolean; onClose: () => void; onSubmit: (input: InviteAdminMemberInput) => void }) {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [quickPlaybooks, setQuickPlaybooks] = useState<QuickPlaybookType[]>([]);
  const [role, setRole] = useState<AdminMemberRole>("user");
  const [initialCredits, setInitialCredits] = useState("");
  const creditAmount = Number(initialCredits);
  const validCredits = !initialCredits.trim() || (Number.isFinite(creditAmount) && creditAmount > 0 && creditAmount <= 1000000 && Number(creditAmount.toFixed(4)) === creditAmount);

  return <Dialog open onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
    <DialogContent className="max-h-[90dvh] max-w-md overflow-hidden rounded-3xl border-[#eaded6] bg-[#faf8f6]" showCloseButton={false}>
      <header className="flex items-start justify-between gap-4 border-b border-border bg-white px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">{t("admin.members.invite.eyebrow")}</p><DialogTitle className="mt-1 text-xl tracking-tight">{t("admin.members.invite.title")}</DialogTitle><DialogDescription className="mt-1 text-xs">{t("admin.members.invite.description")}</DialogDescription></div><DialogClose render={<button type="button" className="rounded-xl p-2 text-muted-foreground hover:bg-surface-muted" aria-label={t("admin.members.invite.close")} disabled={busy} />}><X size={19} /></DialogClose></header>
      <form className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={(event) => { event.preventDefault(); if (!validCredits || !quickPlaybooks.length) return; onSubmit({ email: email.trim(), role, quick_playbooks: quickPlaybooks, ...(displayName.trim() ? { display_name: displayName.trim() } : {}), ...(recipientName.trim() ? { recipient_name: recipientName.trim() } : {}), ...(initialCredits.trim() ? { initial_credits: creditAmount } : {}) }); }}>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <label className="block text-xs font-semibold">{t("admin.members.invite.email")}<input autoFocus type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" placeholder="name@example.com" required /></label>
          <label className="block text-xs font-semibold">{t("admin.members.invite.recipientName")} <span className="font-normal text-muted-foreground">{t("admin.members.invite.optional")}</span><input maxLength={160} value={recipientName} onChange={(event) => setRecipientName(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" placeholder={t("admin.members.invite.recipientNamePlaceholder")} /><span className="mt-1 block text-[10px] font-normal text-muted-foreground">{t("admin.members.invite.recipientNameHint")}</span></label>
          <fieldset className="space-y-2"><legend className="text-xs font-semibold">{t("admin.members.invite.quickPlaybook")} <span className="font-normal text-muted-foreground">{t("admin.members.invite.quickPlaybookSelected", { count: quickPlaybooks.length })}</span></legend><div className="mt-2 grid gap-2 rounded-xl border border-border bg-white p-3 sm:grid-cols-2">{quickPlaybookOptions.map(({ value, label }) => <label key={value} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium hover:bg-[#fcfaf8]"><input type="checkbox" checked={quickPlaybooks.includes(value)} onChange={() => setQuickPlaybooks((current) => toggleQuickPlaybook(current, value))} className="h-4 w-4 accent-[#ed4b2a]" />{t(`admin.members.invite.quickPlaybook.${label}`)}</label>)}</div><span className="block text-[10px] font-normal text-muted-foreground">{t("admin.members.invite.quickPlaybookHint")}</span></fieldset>
          <label className="block text-xs font-semibold">{t("admin.members.invite.displayName")} <span className="font-normal text-muted-foreground">{t("admin.members.invite.optional")}</span><input maxLength={160} value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" placeholder={t("admin.members.invite.displayNamePlaceholder")} /></label>
          <label className="block text-xs font-semibold">{t("admin.members.invite.initialCredits")} <span className="font-normal text-muted-foreground">{t("admin.members.invite.optional")}</span><input type="number" min="0.0001" max="1000000" step="0.0001" value={initialCredits} onChange={(event) => setInitialCredits(event.target.value)} aria-invalid={!validCredits} className="mt-2 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" placeholder={t("admin.members.invite.initialCreditsPlaceholder")} /><span className="mt-1 block text-[10px] font-normal text-muted-foreground">{t("admin.members.invite.initialCreditsHint")}</span></label>
          <label className="block text-xs font-semibold">{t("admin.members.invite.accountRole")}<select value={role} onChange={(event) => setRole(event.target.value as AdminMemberRole)} className="mt-2 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-primary"><option value="user">{t("admin.members.invite.userRole")}</option><option value="admin">{t("admin.members.invite.adminRole")}</option></select><span className="mt-1 block text-[10px] font-normal text-muted-foreground">{t("admin.members.invite.adminRoleHint")}</span></label>
        </div>
        <footer className="flex shrink-0 justify-end gap-2 border-t border-border bg-white px-5 py-4"><Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={busy}>{t("admin.members.invite.cancel")}</Button><Button type="submit" size="sm" disabled={!email.trim() || !quickPlaybooks.length || !validCredits || busy}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : <UserPlus size={15} />} {busy ? t("admin.members.invite.sending") : t("admin.members.invite.send")}</Button></footer>
      </form>
    </DialogContent>
  </Dialog>;
}

function ResendQuickPlaybookDialog({ member, busy, onClose, onSubmit }: { member: AdminMember; busy: boolean; onClose: () => void; onSubmit: (quickPlaybooks: QuickPlaybookType[]) => void }) {
  const { t } = useLocale();
  const [quickPlaybooks, setQuickPlaybooks] = useState<QuickPlaybookType[]>(member.quickPlaybookTypes ?? (member.quickPlaybookType ? [member.quickPlaybookType] : []));

  return <Dialog open onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
    <DialogContent className="max-w-md overflow-hidden rounded-3xl border-[#eaded6] bg-[#faf8f6]" showCloseButton={false}>
      <header className="flex items-start justify-between gap-4 border-b border-border bg-white px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">{t("admin.members.invite.eyebrow")}</p><DialogTitle className="mt-1 text-xl tracking-tight">{t("admin.members.invite.resendPlaybookTitle")}</DialogTitle><DialogDescription className="mt-1 text-xs">{t("admin.members.invite.resendPlaybookDescription", { email: member.email })}</DialogDescription></div><DialogClose render={<button type="button" className="rounded-xl p-2 text-muted-foreground hover:bg-surface-muted" aria-label={t("admin.members.invite.close")} disabled={busy} />}><X size={19} /></DialogClose></header>
      <form onSubmit={(event) => { event.preventDefault(); if (quickPlaybooks.length) onSubmit(quickPlaybooks); }}>
        <fieldset className="space-y-2 p-5"><legend className="text-xs font-semibold">{t("admin.members.invite.quickPlaybook")} <span className="font-normal text-muted-foreground">{t("admin.members.invite.quickPlaybookSelected", { count: quickPlaybooks.length })}</span></legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{quickPlaybookOptions.map(({ value, label }) => <label key={value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium hover:bg-[#fcfaf8]"><input type="checkbox" checked={quickPlaybooks.includes(value)} onChange={() => setQuickPlaybooks((current) => toggleQuickPlaybook(current, value))} className="h-4 w-4 accent-[#ed4b2a]" />{t(`admin.members.invite.quickPlaybook.${label}`)}</label>)}</div></fieldset>
        <footer className="flex justify-end gap-2 border-t border-border bg-white px-5 py-4"><Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={busy}>{t("admin.members.invite.cancel")}</Button><Button type="submit" size="sm" disabled={!quickPlaybooks.length || busy}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : <RefreshCw size={15} />} {t("admin.members.invite.resend")}</Button></footer>
      </form>
    </DialogContent>
  </Dialog>;
}

function MemberRow({ member, busy, assessmentSent, onChange, onCredit, onResend, onSendAssessment }: { member: AdminMember; busy: boolean; assessmentSent: boolean; onChange: (input: { role?: AdminMemberRole; status?: AdminMemberStatus }) => void; onCredit: () => void; onResend: () => void; onSendAssessment: () => void }) {
  const { t } = useLocale();
  return <article className="rounded-2xl border border-[#eaded6] bg-white p-4 shadow-[0_8px_24px_rgba(68,49,36,0.04)] sm:p-5">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#201d1b] text-xs font-bold text-white">{initials(member)}</span><div className="min-w-0"><p className="truncate text-sm font-bold">{member.displayName || member.username || "Unnamed member"}</p><p className="truncate text-xs text-muted-foreground">{member.email}</p><p className="mt-1 text-[10px] text-muted-foreground">Joined {formatDate(member.createdAt)} · {formatDate(member.lastSeenAt)}</p></div></div><div className="grid gap-3 sm:grid-cols-2 xl:flex xl:items-center"><div className="min-w-[145px]"><p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Role</p><select value={member.role} onChange={(event) => onChange({ role: event.target.value as AdminMemberRole })} disabled={busy} className="h-9 w-full rounded-lg border border-border bg-[#fcfaf8] px-2.5 text-xs font-semibold outline-none focus:border-primary"><option value="user">User</option><option value="admin">Admin</option></select></div><div className="min-w-[145px]"><p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Status</p><select value={member.status} onChange={(event) => onChange({ status: event.target.value as AdminMemberStatus })} disabled={busy} className="h-9 w-full rounded-lg border border-border bg-[#fcfaf8] px-2.5 text-xs font-semibold outline-none focus:border-primary"><option value="active">Active</option><option value="suspended">Suspended</option></select></div><div className="min-w-[130px] rounded-xl bg-[#fff8f3] px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Credits</p><p className="mt-0.5 text-base font-bold text-primary">{formatCredits(member.creditBalance)}</p></div><Button type="button" variant="outline" size="sm" className="h-9 self-end xl:self-auto" onClick={onCredit} disabled={busy}><Coins size={14} /> Add credits</Button></div></div>
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3"><Badge tone={member.role === "admin" ? "orange" : "neutral"}>{member.role === "admin" ? "Administrator" : "Member"}</Badge><Badge tone={member.status === "active" ? "success" : "warning"}>{member.status === "active" ? "Active" : "Suspended"}</Badge><Badge tone={member.emailConfirmed ? "success" : "warning"}>{member.emailConfirmed ? "Email confirmed" : "Email not confirmed"}</Badge>{assessmentSent ? <Badge tone="success">Assessment sent</Badge> : null}{member.quickPlaybookTypes?.length ? <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onSendAssessment}>{busy ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />} {assessmentSent ? "Send again" : "Send assessment"} ({member.quickPlaybookTypes.length})</Button> : null}<>{member.invitationPending ? <><Badge tone="warning">{t("admin.members.invite.pending")}</Badge><Button type="button" variant="outline" size="sm" disabled={busy} onClick={onResend}>{busy ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />} {t("admin.members.invite.resend")}</Button></> : null}</><span className="ml-1 text-[10px] text-muted-foreground">Permissions: {member.permissions.map((permission) => permissionLabels[permission] ?? permission).join(" · ")}</span></div>
  </article>;
}
function AdminMembersContent() {
  const { t } = useLocale();
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<AdminMemberRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<AdminMemberStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [creditMember, setCreditMember] = useState<AdminMember | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resendTarget, setResendTarget] = useState<AdminMember | null>(null);
  const [assessmentTarget, setAssessmentTarget] = useState<AdminMember | null>(null);
  const [assessmentSentIds, setAssessmentSentIds] = useState<string[]>([]);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const response = await listAdminMembers({ q: query, role: roleFilter, status: statusFilter, page, limit: 25 }); setMembers(response.members); setTotal(response.pagination.total); setTotalPages(response.pagination.totalPages); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load members"); }
    finally { setLoading(false); }
  }, [page, query, roleFilter, statusFilter]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, query.trim() ? 300 : 0); return () => window.clearTimeout(timer); }, [load, query]);

  const updateMember = async (member: AdminMember, input: { role?: AdminMemberRole; status?: AdminMemberStatus }) => {
    setBusyId(member.id); setError(""); setMessage("");
    try { const updated = await updateAdminMember(member.id, input); setMembers((current) => current.map((item) => item.id === updated.id ? updated : item)); setMessage(`${updated.email} updated.`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update member"); }
    finally { setBusyId(""); }
  };

  const addCredits = async (amount: number, reason: string) => {
    if (!creditMember) return;
    setBusyId(creditMember.id); setError(""); setMessage("");
    try {
      const idempotencyKey = typeof window !== "undefined" && window.crypto?.randomUUID ? `admin-grant:${window.crypto.randomUUID()}` : `admin-grant:${creditMember.id}:${Date.now()}`;
      const result = await grantAdminMemberCredits(creditMember.id, { credits: amount, reason: reason || undefined, idempotencyKey });
      setMembers((current) => current.map((item) => item.id === result.memberId ? { ...item, creditBalance: result.balance } : item));
      setCreditMember(null); setMessage(`${formatCredits(result.creditsAdded)} credits added to ${creditMember.email}.`);
    } catch (reasonError) { setError(reasonError instanceof Error ? reasonError.message : "Unable to add credits"); }
    finally { setBusyId(""); }
  };

  const sendInvitation = async (input: InviteAdminMemberInput) => {
    setInviteBusy(true); setError(""); setMessage("");
    try {
      const result = await inviteAdminMember(input);
      setInviteOpen(false);
      const creditMessage = result.initialCreditsAdded === null ? "" : result.initialCreditsAdded > 0 ? t("admin.members.invite.creditsAssigned", { credits: formatCredits(result.initialCreditsAdded) }) : t("admin.members.invite.creditsAlreadyAssigned");
      setMessage(t("admin.members.invite.sent", { email: result.email, details: creditMessage }));
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("admin.members.invite.error")); }
    finally { setInviteBusy(false); }
  };

  const resendInvitation = async (member: AdminMember, quickPlaybooks?: QuickPlaybookType[]) => {
    if (!quickPlaybooks?.length) { setResendTarget(member); return; }
    setResendTarget(null);
    setBusyId(member.id); setError(""); setMessage("");
    try {
      const result = await resendAdminMemberInvitation(member.id, { quick_playbooks: quickPlaybooks });
      setMessage(t("admin.members.invite.resent", { email: result.email }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("admin.members.invite.error")); }
    finally { setBusyId(""); }
  };

  const sendAssessment = async () => {
    if (!assessmentTarget) return;
    const member = assessmentTarget;
    setBusyId(member.id); setError(""); setMessage("");
    try {
      const result = await sendAdminMemberAssessment(member.id);
      setAssessmentSentIds((current) => current.includes(member.id) ? current : [...current, member.id]);
      setAssessmentTarget(null);
      setMessage(`Assessment email sent to ${result.email} (${result.formCount} ${result.formCount === 1 ? "form" : "forms"}).`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to send assessment email"); }
    finally { setBusyId(""); }
  };

  const stats = useMemo(() => ({ admins: members.filter((member) => member.role === "admin").length, active: members.filter((member) => member.status === "active").length, credits: members.reduce((sum, member) => sum + member.creditBalance, 0) }), [members]);

  return <SidebarProvider><div className="min-h-screen w-full min-w-0 bg-background"><SidebarNavigation /><div className="min-w-0 xl:pl-[var(--sidebar-width)]"><StudioHeader /><main className="page-gutter mx-auto w-full max-w-[1600px] py-5 lg:py-8"><div className="min-h-[calc(100vh-120px)] overflow-x-clip rounded-3xl bg-[#faf8f6] px-4 pb-20 sm:px-6 lg:px-8 lg:pb-24"><div className="mx-auto max-w-[1180px] pt-6 lg:pt-8">
    <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#201d1b] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white"><UsersRound size={13} /> Operations</div><h1 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">Members & roles</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Manage account access, role permissions, and member credit balances from one place.</p></div><div className="flex flex-wrap gap-2"><Button size="lg" onClick={() => { setError(""); setMessage(""); setInviteOpen(true); }}><UserPlus size={16} /> {t("admin.members.invite.open")}</Button><Button variant="outline" size="lg" onClick={() => void load()} disabled={loading || Boolean(busyId)}><RefreshCw size={16} className={loading ? "animate-spin" : undefined} /> Refresh</Button></div></div>
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-[#eaded6] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Members shown</p><p className="mt-2 text-2xl font-bold">{total}</p></div><div className="rounded-2xl border border-[#eaded6] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Active / admins</p><p className="mt-2 text-2xl font-bold text-[#347454]">{stats.active} <span className="text-sm font-semibold text-muted-foreground">/ {stats.admins}</span></p></div><div className="rounded-2xl border border-[#eaded6] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Credits in view</p><p className="mt-2 text-2xl font-bold text-primary">{formatCredits(stats.credits)}</p></div></div>
    {error ? <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#efc2c2] bg-[#fff6f6] p-4 text-sm text-[#9f3b3b]" role="alert"><AlertCircle size={18} className="mt-0.5 shrink-0" /><p>{error}</p></div> : null}{message ? <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[#bfe1cc] bg-[#f3fbf5] p-4 text-sm text-[#347454]" role="status"><CheckCircle2 size={18} /><p className="font-semibold">{message}</p></div> : null}
    <div className="mb-5 grid gap-4 lg:grid-cols-2"><RolePermissionCard role="admin" title="Administrator" description="Full operational access. Use sparingly and review this role regularly." permissions={["Manage members", "Manage credits", "Manage admin settings"]} /><RolePermissionCard role="user" title="Member" description="Can create content and manage their own assets and history." permissions={["Create content", "Manage own assets", "View own history"]} /></div>
    <section aria-label="Member filters" className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#eaded6] bg-white p-3 sm:flex-row"><SearchInput size="compact" className="min-w-0 flex-1" value={query} onValueChange={(value) => { setQuery(value); setPage(1); }} placeholder="Search by email, name, or username" aria-label="Search members" /><select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value as AdminMemberRole | "all"); setPage(1); }} aria-label="Filter members by role" className="h-10 rounded-xl border border-border bg-[#fcfbfa] px-3 text-xs font-semibold outline-none focus:border-primary"><option value="all">All roles</option><option value="user">Members</option><option value="admin">Administrators</option></select><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as AdminMemberStatus | "all"); setPage(1); }} aria-label="Filter members by status" className="h-10 rounded-xl border border-border bg-[#fcfbfa] px-3 text-xs font-semibold outline-none focus:border-primary"><option value="all">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></select></section>
    {loading ? <div className="space-y-3"><div className="h-40 animate-pulse rounded-2xl border border-border bg-white" /><div className="h-40 animate-pulse rounded-2xl border border-border bg-white" /></div> : members.length === 0 ? <div className="rounded-2xl border border-dashed border-[#d8d0ca] bg-white p-12 text-center"><UserRound className="mx-auto text-primary" size={30} /><p className="mt-3 text-sm font-bold">No members found</p><p className="mt-1 text-xs text-muted-foreground">Try another search or filter.</p></div> : <><div className="space-y-3">{members.map((member) => <MemberRow key={member.id} member={member} busy={Boolean(busyId)} onResend={() => void resendInvitation(member)} assessmentSent={assessmentSentIds.includes(member.id)} onSendAssessment={() => { setError(""); setMessage(""); setAssessmentTarget(member); }} onChange={(input) => void updateMember(member, input)} onCredit={() => { setError(""); setMessage(""); setCreditMember(member); }} />)}</div>{totalPages > 1 ? <div className="mt-4 flex items-center justify-between rounded-2xl border border-[#eaded6] bg-white px-4 py-3"><p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p><div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || page === 1}><ChevronLeft size={14} /> Previous</Button><Button type="button" variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={loading || page === totalPages}>Next <ChevronRight size={14} /></Button></div></div> : null}</>}
    <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#eaded6] bg-[#fffdfb] p-4 text-xs text-muted-foreground"><Coins className="mt-0.5 shrink-0 text-primary" size={16} /><p>Credit grants are recorded as auditable transactions and protected with an idempotency key. The server also prevents removing the last active administrator.</p></div>
    </div></div></main></div></div>{creditMember ? <CreditDialog member={creditMember} busy={busyId === creditMember.id} onClose={() => setCreditMember(null)} onSubmit={(amount, reason) => void addCredits(amount, reason)} /> : null}{inviteOpen ? <InviteDialog busy={inviteBusy} onClose={() => setInviteOpen(false)} onSubmit={(input) => void sendInvitation(input)} /> : null}{resendTarget ? <ResendQuickPlaybookDialog member={resendTarget} busy={busyId === resendTarget.id} onClose={() => setResendTarget(null)} onSubmit={(quickPlaybooks) => void resendInvitation(resendTarget, quickPlaybooks)} /> : null}{assessmentTarget ? <AssessmentDialog member={assessmentTarget} sent={assessmentSentIds.includes(assessmentTarget.id)} busy={busyId === assessmentTarget.id} error={error} onClose={() => setAssessmentTarget(null)} onSubmit={() => void sendAssessment()} /> : null}</SidebarProvider>;
}

export default function AdminMembersPage() {
  return <AdminMembersContent />;
}
