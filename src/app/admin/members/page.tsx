"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Coins, LoaderCircle, Plus, RefreshCw, Search, ShieldCheck, UserRound, UsersRound, X } from "lucide-react";
import { SidebarNavigation } from "@/components/app-shell/navigation";
import { StudioHeader } from "@/components/app-shell/studio-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SidebarProvider } from "@/components/ui/sidebar";
import { grantAdminMemberCredits, listAdminMembers, updateAdminMember, type AdminMember, type AdminMemberRole, type AdminMemberStatus } from "@/lib/api/admin-members";

const permissionLabels: Record<string, string> = {
  create_content: "Create content",
  manage_own_assets: "Manage own assets",
  manage_own_history: "View own history",
  manage_members: "Manage members",
  manage_credits: "Manage credits",
  manage_admin_settings: "Manage admin settings",
};

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

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#201d1b]/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="credit-dialog-title">
    <div className="w-full max-w-md overflow-hidden rounded-3xl border border-[#eaded6] bg-[#faf8f6] shadow-[0_24px_80px_rgba(68,49,36,0.25)]">
      <header className="flex items-start justify-between gap-4 border-b border-border bg-white px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">Credit adjustment</p><h2 id="credit-dialog-title" className="mt-1 text-xl font-bold tracking-tight">Add credits</h2><p className="mt-1 text-xs text-muted-foreground">{member.displayName || member.email} · current balance {formatCredits(member.creditBalance)}</p></div><button type="button" onClick={onClose} className="rounded-xl p-2 text-muted-foreground hover:bg-surface-muted" aria-label="Close add credits dialog"><X size={19} /></button></header>
      <form onSubmit={(event) => { event.preventDefault(); if (valid) onSubmit(amount, reason.trim()); }}>
        <div className="space-y-4 p-5"><label className="block text-xs font-semibold">Credits to add<input autoFocus type="number" min="0.0001" max="1000000" step="0.0001" value={credits} onChange={(event) => setCredits(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" placeholder="100" required /><span className="mt-1 block text-[10px] font-normal text-muted-foreground">This is a grant and will be recorded in the member’s credit transactions.</span></label><label className="block text-xs font-semibold">Reason <span className="font-normal text-muted-foreground">(optional)</span><input maxLength={240} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-primary/10" placeholder="Customer support compensation" /></label></div>
        <footer className="flex justify-end gap-2 border-t border-border bg-white px-5 py-4"><Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" size="sm" disabled={!valid || busy}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Plus size={15} />} {busy ? "Adding…" : "Add credits"}</Button></footer>
      </form>
    </div>
  </div>;
}

function MemberRow({ member, busy, onChange, onCredit }: { member: AdminMember; busy: boolean; onChange: (input: { role?: AdminMemberRole; status?: AdminMemberStatus }) => void; onCredit: () => void }) {
  return <article className="rounded-2xl border border-[#eaded6] bg-white p-4 shadow-[0_8px_24px_rgba(68,49,36,0.04)] sm:p-5"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#201d1b] text-xs font-bold text-white">{initials(member)}</span><div className="min-w-0"><p className="truncate text-sm font-bold">{member.displayName || member.username || "Unnamed member"}</p><p className="truncate text-xs text-muted-foreground">{member.email}</p><p className="mt-1 text-[10px] text-muted-foreground">Joined {formatDate(member.createdAt)} · {formatDate(member.lastSeenAt)}</p></div></div><div className="grid gap-3 sm:grid-cols-2 xl:flex xl:items-center"><div className="min-w-[145px]"><p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Role</p><select value={member.role} onChange={(event) => onChange({ role: event.target.value as AdminMemberRole })} disabled={busy} className="h-9 w-full rounded-lg border border-border bg-[#fcfaf8] px-2.5 text-xs font-semibold outline-none focus:border-primary"><option value="user">User</option><option value="admin">Admin</option></select></div><div className="min-w-[145px]"><p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Status</p><select value={member.status} onChange={(event) => onChange({ status: event.target.value as AdminMemberStatus })} disabled={busy} className="h-9 w-full rounded-lg border border-border bg-[#fcfaf8] px-2.5 text-xs font-semibold outline-none focus:border-primary"><option value="active">Active</option><option value="suspended">Suspended</option></select></div><div className="min-w-[130px] rounded-xl bg-[#fff8f3] px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Credits</p><p className="mt-0.5 text-base font-bold text-primary">{formatCredits(member.creditBalance)}</p></div><Button type="button" variant="outline" size="sm" className="h-9 self-end xl:self-auto" onClick={onCredit} disabled={busy}><Coins size={14} /> Add credits</Button></div></div><div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3"><Badge tone={member.role === "admin" ? "orange" : "neutral"}>{member.role === "admin" ? "Administrator" : "Member"}</Badge><Badge tone={member.status === "active" ? "success" : "warning"}>{member.status === "active" ? "Active" : "Suspended"}</Badge><Badge tone={member.emailConfirmed ? "success" : "warning"}>{member.emailConfirmed ? "Email confirmed" : "Email not confirmed"}</Badge><span className="ml-1 text-[10px] text-muted-foreground">Permissions: {member.permissions.map((permission) => permissionLabels[permission] ?? permission).join(" · ")}</span></div></article>;
}

function AdminMembersContent() {
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

  const stats = useMemo(() => ({ admins: members.filter((member) => member.role === "admin").length, active: members.filter((member) => member.status === "active").length, credits: members.reduce((sum, member) => sum + member.creditBalance, 0) }), [members]);

  return <SidebarProvider><div className="min-h-screen w-full min-w-0 bg-background"><SidebarNavigation /><div className="min-w-0 lg:pl-[var(--sidebar-width)]"><StudioHeader /><main className="page-gutter mx-auto w-full max-w-[1600px] py-5 lg:py-8"><div className="min-h-[calc(100vh-120px)] overflow-x-clip rounded-3xl bg-[#faf8f6] px-4 pb-20 sm:px-6 lg:px-8 lg:pb-24"><div className="mx-auto max-w-[1180px] pt-6 lg:pt-8">
    <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#201d1b] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white"><UsersRound size={13} /> Operations</div><h1 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">Members & roles</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Manage account access, role permissions, and member credit balances from one place.</p></div><Button variant="outline" size="lg" onClick={() => void load()} disabled={loading || Boolean(busyId)}><RefreshCw size={16} className={loading ? "animate-spin" : undefined} /> Refresh</Button></div>
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-[#eaded6] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Members shown</p><p className="mt-2 text-2xl font-bold">{total}</p></div><div className="rounded-2xl border border-[#eaded6] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Active / admins</p><p className="mt-2 text-2xl font-bold text-[#347454]">{stats.active} <span className="text-sm font-semibold text-muted-foreground">/ {stats.admins}</span></p></div><div className="rounded-2xl border border-[#eaded6] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Credits in view</p><p className="mt-2 text-2xl font-bold text-primary">{formatCredits(stats.credits)}</p></div></div>
    {error ? <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#efc2c2] bg-[#fff6f6] p-4 text-sm text-[#9f3b3b]" role="alert"><AlertCircle size={18} className="mt-0.5 shrink-0" /><p>{error}</p></div> : null}{message ? <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[#bfe1cc] bg-[#f3fbf5] p-4 text-sm text-[#347454]" role="status"><CheckCircle2 size={18} /><p className="font-semibold">{message}</p></div> : null}
    <div className="mb-5 grid gap-4 lg:grid-cols-2"><RolePermissionCard role="admin" title="Administrator" description="Full operational access. Use sparingly and review this role regularly." permissions={["Manage members", "Manage credits", "Manage admin settings"]} /><RolePermissionCard role="user" title="Member" description="Can create content and manage their own assets and history." permissions={["Create content", "Manage own assets", "View own history"]} /></div>
    <section aria-label="Member filters" className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#eaded6] bg-white p-3 sm:flex-row"><div className="relative min-w-0 flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search by email, name, or username" aria-label="Search members" className="h-10 w-full rounded-xl border border-border bg-[#fcfbfa] pl-9 pr-3 text-xs outline-none focus:border-primary" /></div><select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value as AdminMemberRole | "all"); setPage(1); }} aria-label="Filter members by role" className="h-10 rounded-xl border border-border bg-[#fcfbfa] px-3 text-xs font-semibold outline-none focus:border-primary"><option value="all">All roles</option><option value="user">Members</option><option value="admin">Administrators</option></select><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as AdminMemberStatus | "all"); setPage(1); }} aria-label="Filter members by status" className="h-10 rounded-xl border border-border bg-[#fcfbfa] px-3 text-xs font-semibold outline-none focus:border-primary"><option value="all">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></select></section>
    {loading ? <div className="space-y-3"><div className="h-40 animate-pulse rounded-2xl border border-border bg-white" /><div className="h-40 animate-pulse rounded-2xl border border-border bg-white" /></div> : members.length === 0 ? <div className="rounded-2xl border border-dashed border-[#d8d0ca] bg-white p-12 text-center"><UserRound className="mx-auto text-primary" size={30} /><p className="mt-3 text-sm font-bold">No members found</p><p className="mt-1 text-xs text-muted-foreground">Try another search or filter.</p></div> : <><div className="space-y-3">{members.map((member) => <MemberRow key={member.id} member={member} busy={busyId === member.id} onChange={(input) => void updateMember(member, input)} onCredit={() => { setError(""); setMessage(""); setCreditMember(member); }} />)}</div>{totalPages > 1 ? <div className="mt-4 flex items-center justify-between rounded-2xl border border-[#eaded6] bg-white px-4 py-3"><p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p><div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || page === 1}><ChevronLeft size={14} /> Previous</Button><Button type="button" variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={loading || page === totalPages}>Next <ChevronRight size={14} /></Button></div></div> : null}</>}
    <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#eaded6] bg-[#fffdfb] p-4 text-xs text-muted-foreground"><Coins className="mt-0.5 shrink-0 text-primary" size={16} /><p>Credit grants are recorded as auditable transactions and protected with an idempotency key. The server also prevents removing the last active administrator.</p></div>
    </div></div></main></div></div>{creditMember ? <CreditDialog member={creditMember} busy={busyId === creditMember.id} onClose={() => setCreditMember(null)} onSubmit={(amount, reason) => void addCredits(amount, reason)} /> : null}</SidebarProvider>;
}

export default function AdminMembersPage() {
  return <AdminMembersContent />;
}
