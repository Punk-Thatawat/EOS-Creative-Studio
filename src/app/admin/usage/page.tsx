"use client";

import { useEffect, useState } from "react";
import { Activity, AlertCircle, AudioLines, Check, ChevronLeft, ChevronRight, Clock3, Coins, ExternalLink, FileText, Image as ImageIcon, LoaderCircle, RefreshCw, Search, ShieldCheck, UserRound, Video, X } from "lucide-react";
import { SidebarNavigation } from "@/components/app-shell/navigation";
import { StudioHeader } from "@/components/app-shell/studio-header";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { SidebarProvider } from "@/components/ui/sidebar";
import { fetchAdminMemberHistory, listAdminMembers, type AdminMember, type AdminMemberRole, type AdminMemberStatus } from "@/lib/api/admin-members";
import type { HistoryItem, HistoryStatus, HistoryType } from "@/lib/api/history";

const MEMBER_PAGE_SIZE = 25;
const HISTORY_PAGE_SIZE = 24;
const statusLabels: Record<Exclude<HistoryStatus, "all">, string> = {
  queued: "Queued",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};
const featureLabels: Record<string, string> = {
  "text-to-image": "Text to Image",
  "image-to-image": "Image to Image",
  "style-transfer": "Style Transfer",
  "background-removal": "Background Removal",
  "extend-image": "Extend Image",
  upscale: "Upscale",
  "image-to-video": "Image to Video",
  "reference-to-video": "Reference to Video",
  "text-to-video": "Text to Video",
  "people-video": "AI Presenter Video",
  lipsync: "Lip Sync",
  "motion-transfer": "Motion Control",
  tts: "Text to Speech",
  dialogue: "Podcast & Dialogue",
  "voice-clone": "Voice Clone",
  "sound-effects": "Sound Effects",
  "audio-cleanup": "Audio Cleanup",
  "document-summary": "Document Summary",
};

function formatCredits(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(value);
}

function initials(member: AdminMember) {
  return (member.displayName?.trim() || member.username?.trim() || member.email).slice(0, 2).toUpperCase();
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown date"
    : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function mediaIcon(kind: HistoryItem["mediaKind"]) {
  if (kind === "image") return ImageIcon;
  if (kind === "video") return Video;
  if (kind === "document") return FileText;
  return AudioLines;
}

function statusIcon(status: HistoryItem["status"]) {
  if (status === "completed") return Check;
  if (status === "failed") return AlertCircle;
  if (status === "cancelled") return X;
  if (status === "queued") return Clock3;
  return LoaderCircle;
}

function WorkPreview({ item }: { item: HistoryItem }) {
  const Icon = mediaIcon(item.mediaKind);
  if (!item.outputUrl) {
    if (item.documentSummary) return <div className="flex h-36 flex-col justify-center gap-2 overflow-hidden rounded-xl bg-[#fff7f2] p-3 text-[#655b55]"><FileText size={20} className="text-primary" /><b className="truncate text-xs">{item.documentSummary.filename}</b><p className="line-clamp-3 text-[11px] leading-4">{item.documentSummary.summary.executiveSummary}</p></div>;
    return <div className="flex h-36 items-center justify-center rounded-xl bg-[#f7f3f0] text-muted-foreground"><Icon size={30} /></div>;
  }
  if (item.mediaKind === "image") {
    return <a href={item.outputUrl} target="_blank" rel="noreferrer" aria-label={`Open generated image: ${item.title}`} className="block overflow-hidden rounded-xl bg-[#f7f3f0]"><img src={item.outputUrl} alt={item.title} loading="lazy" className="h-36 w-full object-cover" /></a>;
  }
  if (item.mediaKind === "video") {
    return <video src={item.outputUrl} controls playsInline preload="metadata" className="h-36 w-full rounded-xl bg-black object-contain" aria-label={`Generated video: ${item.title}`} />;
  }
  return <div className="flex h-36 flex-col justify-center gap-3 rounded-xl bg-[#f7f3f0] p-3 text-primary"><AudioLines size={22} /><audio src={item.outputUrl} controls preload="none" className="w-full" aria-label={`Generated audio: ${item.title}`} /></div>;
}

function HistoryCard({ item }: { item: HistoryItem }) {
  const Icon = mediaIcon(item.mediaKind);
  const StatusIcon = statusIcon(item.status);
  const statusTone = item.status === "completed" ? "bg-[#e9f6ed] text-[#347454]" : item.status === "failed" || item.status === "cancelled" ? "bg-[#fff0ed] text-[#b34a35]" : "bg-[#fff5df] text-[#946500]";
  return <article className="grid gap-4 rounded-2xl border border-[#eaded6] bg-white p-3 sm:grid-cols-[190px_minmax(0,1fr)] sm:p-4">
    <WorkPreview item={item} />
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#f7f3f0] px-2.5 py-1 text-[10px] font-semibold capitalize text-[#625952]"><Icon size={12} />{item.mediaKind}</span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusTone}`}><StatusIcon size={12} className={item.status === "processing" ? "animate-spin" : undefined} />{statusLabels[item.status]}</span>
      </div>
      <h3 className="mt-2 break-words text-sm font-bold leading-5">{item.title || featureLabels[item.feature] || item.feature}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{featureLabels[item.feature] || item.feature} · {formatDate(item.createdAt)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{item.modelLabel || item.model || "Model not recorded"}{item.provider ? ` · ${item.provider}` : ""}{item.creditCost != null ? ` · ${item.creditCost.toLocaleString()} credits` : ""}</p>
      {item.prompt && item.prompt !== item.title ? <details className="mt-3 rounded-xl bg-[#fcfaf8] px-3 py-2"><summary className="cursor-pointer text-xs font-semibold text-[#655b55]">View prompt</summary><p className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">{item.prompt}</p></details> : null}
      {item.errorMessage ? <p className="mt-2 rounded-lg bg-[#fff6f6] px-3 py-2 text-xs text-[#9f3b3b]">{item.errorMessage}</p> : null}
      {item.outputUrl ? <a href={item.outputUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">Open output <ExternalLink size={13} /></a> : null}
    </div>
  </article>;
}

function UserActivityDashboard() {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [memberPage, setMemberPage] = useState(1);
  const [memberPages, setMemberPages] = useState(1);
  const [memberSearch, setMemberSearch] = useState("");
  const [role, setRole] = useState<AdminMemberRole | "all">("all");
  const [memberStatus, setMemberStatus] = useState<AdminMemberStatus | "all">("all");
  const [selectedMember, setSelectedMember] = useState<AdminMember | null>(null);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [mediaType, setMediaType] = useState<HistoryType>("all");
  const [historyStatus, setHistoryStatus] = useState<HistoryStatus>("all");
  const [historyOffset, setHistoryOffset] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof fetchAdminMemberHistory>> | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setMembersLoading(true);
      setMembersError("");
      void listAdminMembers({ q: memberSearch, role, status: memberStatus, page: memberPage, limit: MEMBER_PAGE_SIZE })
        .then((response) => {
          if (controller.signal.aborted) return;
          setMembers(response.members);
          setTotalMembers(response.pagination.total);
          setMemberPages(response.pagination.totalPages);
          setSelectedMember((current) => {
            if (current && response.members.some((member) => member.id === current.id)) return response.members.find((member) => member.id === current.id) ?? current;
            if (current) return current;
            return response.members[0] ?? null;
          });
        })
        .catch((reason: unknown) => { if (!controller.signal.aborted) setMembersError(reason instanceof Error ? reason.message : "Unable to load users"); })
        .finally(() => { if (!controller.signal.aborted) setMembersLoading(false); });
    }, memberSearch.trim() ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [memberPage, memberSearch, memberStatus, refreshKey, role]);

  useEffect(() => {
    if (!selectedMember) {
      setHistory(null);
      setHistoryLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setHistoryLoading(true);
      setHistoryError("");
      void fetchAdminMemberHistory(selectedMember.id, { search: historySearch, type: mediaType, status: historyStatus, offset: historyOffset, limit: HISTORY_PAGE_SIZE, signal: controller.signal })
        .then(setHistory)
        .catch((reason: unknown) => { if (!controller.signal.aborted) setHistoryError(reason instanceof Error ? reason.message : "Unable to load user activity"); })
        .finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    }, historySearch.trim() ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [historyOffset, historySearch, historyStatus, mediaType, refreshKey, selectedMember]);

  const resetHistoryFilters = () => setHistoryOffset(0);
  const summary = history?.summary;
  const overview = [
    { label: "Users matched", value: totalMembers, icon: UserRound, tone: "text-[#347454] bg-[#e9f6ed]" },
    { label: "Selected user jobs", value: summary?.total, icon: Activity, tone: "text-primary bg-[#fff0e9]" },
    { label: "Images", value: summary?.images, icon: ImageIcon, tone: "text-[#7550a2] bg-[#f3ecfc]" },
    { label: "Videos", value: summary?.videos, icon: Video, tone: "text-[#216b9b] bg-[#eaf5fc]" },
    { label: "Audio", value: summary?.audio, icon: AudioLines, tone: "text-[#9a5c12] bg-[#fff5df]" },
    { label: "Documents", value: summary?.documents, icon: FileText, tone: "text-[#bd4a18] bg-[#fff0e8]" },
    { label: "Failed jobs", value: summary?.failed, icon: AlertCircle, tone: "text-[#b34a35] bg-[#fff0ed]" },
  ];

  return <SidebarProvider><div className="min-h-screen w-full min-w-0 bg-background"><SidebarNavigation /><div className="min-w-0 xl:pl-[var(--sidebar-width)]"><StudioHeader /><main className="page-gutter mx-auto w-full max-w-[1600px] py-5 lg:py-8"><div className="min-h-[calc(100vh-120px)] overflow-x-clip rounded-3xl bg-[#faf8f6] px-4 pb-20 sm:px-6 lg:px-8 lg:pb-24"><div className="mx-auto max-w-[1440px] pt-6 lg:pt-8">
    <div className="mb-7 flex flex-col justify-between gap-5 xl:flex-row xl:items-end"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#201d1b] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white"><Activity size={13} /> Operations</div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">User activity</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Review each user’s generated images, videos, and audio, including prompts, models, status, and credit usage.</p></div><Button variant="outline" size="lg" onClick={() => setRefreshKey((key) => key + 1)} disabled={membersLoading || historyLoading}><RefreshCw size={15} className={membersLoading || historyLoading ? "animate-spin" : undefined} /> Refresh dashboard</Button></div>

    <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7">{overview.map(({ label, value, icon: Icon, tone }) => <section key={label} className="rounded-2xl border border-[#eaded6] bg-white p-4"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon size={17} /></span><p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{membersLoading || (selectedMember && historyLoading) ? "—" : value ?? 0}</p></section>)}</div>

    <section aria-label="User filters" className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#eaded6] bg-white p-3 md:flex-row"><SearchInput size="compact" className="min-w-0 flex-1" value={memberSearch} onValueChange={(value) => { setMemberSearch(value); setMemberPage(1); setSelectedMember(null); }} placeholder="Search by email, name, or username" aria-label="Search users" /><select value={role} onChange={(event) => { setRole(event.target.value as AdminMemberRole | "all"); setMemberPage(1); setSelectedMember(null); }} aria-label="Filter users by role" className="h-10 rounded-xl border border-border bg-[#fcfbfa] px-3 text-xs font-semibold outline-none focus:border-primary"><option value="all">All roles</option><option value="user">Members</option><option value="admin">Administrators</option></select><select value={memberStatus} onChange={(event) => { setMemberStatus(event.target.value as AdminMemberStatus | "all"); setMemberPage(1); setSelectedMember(null); }} aria-label="Filter users by account status" className="h-10 rounded-xl border border-border bg-[#fcfbfa] px-3 text-xs font-semibold outline-none focus:border-primary"><option value="all">All account statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></select></section>

    {(membersError || historyError) ? <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-[#efc2c2] bg-[#fff6f6] p-3 text-sm text-[#9f3b3b]"><AlertCircle size={16} className="mt-0.5 shrink-0" />{membersError || historyError}</div> : null}

    <div className="grid min-w-0 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="min-w-0 overflow-hidden rounded-2xl border border-[#eaded6] bg-white">
        <header className="flex items-center justify-between border-b border-border px-4 py-3"><div><h2 className="text-sm font-bold">Users</h2><p className="mt-0.5 text-xs text-muted-foreground">{totalMembers.toLocaleString()} matched</p></div><span className="rounded-full bg-[#f7f3f0] px-2.5 py-1 text-[10px] font-semibold text-[#625952]">Page {memberPage} / {memberPages}</span></header>
        <div className="max-h-[62vh] min-h-52 overflow-y-auto p-2">
          {membersLoading ? <div className="space-y-2 p-2"><div className="h-16 animate-pulse rounded-xl bg-[#f7f3f0]" /><div className="h-16 animate-pulse rounded-xl bg-[#f7f3f0]" /><div className="h-16 animate-pulse rounded-xl bg-[#f7f3f0]" /></div> : members.length ? <div className="space-y-1">{members.map((member) => <button type="button" key={member.id} onClick={() => { setSelectedMember(member); setHistoryOffset(0); }} aria-current={selectedMember?.id === member.id ? "true" : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${selectedMember?.id === member.id ? "bg-[#fff0e9] ring-1 ring-inset ring-[#fac5ae]" : "hover:bg-[#fcfaf8]"}`}><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${selectedMember?.id === member.id ? "bg-primary text-white" : "bg-[#f1ece8] text-[#514842]"}`}>{initials(member)}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{member.displayName || member.username || member.email}</span><span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{member.email}</span><span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><Coins size={11} /> {formatCredits(member.creditBalance)} credits · {member.status}</span></span><ChevronRight size={15} className="shrink-0 text-muted-foreground" /></button>)}</div> : <div className="px-4 py-10 text-center"><Search size={22} className="mx-auto text-muted-foreground" /><p className="mt-2 text-sm font-semibold">No users found</p><p className="mt-1 text-xs text-muted-foreground">Try a different search or role.</p></div>}
        </div>
        {memberPages > 1 ? <footer className="flex items-center justify-between border-t border-border px-3 py-2"><span className="text-[10px] text-muted-foreground">{MEMBER_PAGE_SIZE} per page</span><div className="flex gap-1"><Button type="button" variant="ghost" size="icon-sm" aria-label="Previous user page" onClick={() => setMemberPage((current) => Math.max(1, current - 1))} disabled={membersLoading || memberPage <= 1}><ChevronLeft size={15} /></Button><Button type="button" variant="ghost" size="icon-sm" aria-label="Next user page" onClick={() => setMemberPage((current) => Math.min(memberPages, current + 1))} disabled={membersLoading || memberPage >= memberPages}><ChevronRight size={15} /></Button></div></footer> : null}
      </aside>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-[#eaded6] bg-white">
        {!selectedMember ? <div className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center"><ShieldCheck size={32} className="text-primary" /><h2 className="mt-3 text-base font-bold">Select a user</h2><p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">Choose a user from the list to inspect their generated work and usage details.</p></div> : <>
          <header className="flex flex-col justify-between gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:px-5"><div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#201d1b] text-xs font-bold text-white">{initials(selectedMember)}</span><div className="min-w-0"><h2 className="truncate text-base font-bold">{selectedMember.displayName || selectedMember.username || selectedMember.email}</h2><p className="truncate text-xs text-muted-foreground">{selectedMember.email} · {selectedMember.role} · {selectedMember.status}</p></div></div><span className="shrink-0 rounded-xl bg-[#fff8f3] px-3 py-2 text-xs font-semibold text-primary">Balance: {formatCredits(selectedMember.creditBalance)} credits</span></header>
          <div className="space-y-4 bg-[#faf8f6] p-3 sm:p-5">
            <div className="flex flex-col gap-2 rounded-2xl border border-[#eaded6] bg-white p-3 sm:flex-row"><SearchInput size="compact" className="min-w-0 flex-1" value={historySearch} onValueChange={(value) => { setHistorySearch(value); resetHistoryFilters(); }} placeholder="Search prompt, model, or feature" aria-label="Search generated work" /><select value={mediaType} onChange={(event) => { setMediaType(event.target.value as HistoryType); resetHistoryFilters(); }} aria-label="Filter generated work by media" className="h-10 rounded-xl border border-border bg-[#fcfbfa] px-3 text-xs font-semibold outline-none focus:border-primary"><option value="all">All media</option><option value="image">Images</option><option value="video">Videos</option><option value="audio">Audio</option><option value="document">Documents</option></select><select value={historyStatus} onChange={(event) => { setHistoryStatus(event.target.value as HistoryStatus); resetHistoryFilters(); }} aria-label="Filter generated work by status" className="h-10 rounded-xl border border-border bg-[#fcfbfa] px-3 text-xs font-semibold outline-none focus:border-primary"><option value="all">All statuses</option><option value="queued">Queued</option><option value="processing">Processing</option><option value="completed">Completed</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option></select></div>
            {historyLoading ? <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle size={17} className="animate-spin" /> Loading user activity…</div> : history?.items.length ? <div className="space-y-3">{history.items.map((item) => <HistoryCard key={`${item.source}:${item.id}`} item={item} />)}</div> : !historyError ? <div className="rounded-2xl border border-dashed border-[#d8d0ca] bg-white p-10 text-center"><Activity className="mx-auto text-primary" size={28} /><p className="mt-3 text-sm font-bold">No generated work found</p><p className="mt-1 text-xs text-muted-foreground">Try changing the filters or search term.</p></div> : null}
            {history && history.pagination.total > HISTORY_PAGE_SIZE ? <div className="flex items-center justify-between rounded-xl border border-[#eaded6] bg-white px-3 py-2"><p className="text-xs text-muted-foreground">Showing {historyOffset + 1}–{historyOffset + history.items.length} of {history.pagination.total} jobs</p><div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setHistoryOffset((current) => Math.max(0, current - HISTORY_PAGE_SIZE))} disabled={historyLoading || historyOffset === 0}><ChevronLeft size={14} /> Previous</Button><Button type="button" variant="outline" size="sm" onClick={() => setHistoryOffset((current) => current + HISTORY_PAGE_SIZE)} disabled={historyLoading || !history.pagination.hasMore}>Next <ChevronRight size={14} /></Button></div></div> : history && history.pagination.total > 0 ? <p className="px-1 text-[10px] text-muted-foreground">{history.pagination.total} jobs matched · {summary?.completed ?? 0} completed · {summary?.inProgress ?? 0} in progress</p> : null}
          </div>
        </>}
      </section>
    </div>
    </div></div></main></div></div></SidebarProvider>;
}

export default function AdminUsagePage() {
  return <UserActivityDashboard />;
}
