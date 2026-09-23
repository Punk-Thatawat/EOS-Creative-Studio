"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, FileText, LoaderCircle, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { SidebarNavigation } from "@/components/app-shell/navigation";
import { StudioHeader } from "@/components/app-shell/studio-header";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { getAdminLegalDocument, updateAdminLegalDocument, type AdminLegalDocument, type LegalSlug } from "@/lib/api/legal";
import { legalDocuments, type LegalDocument } from "@/features/legal/legal-documents";

type DraftSection = { heading: string; paragraphsText: string; bulletsText: string };
type Draft = Omit<AdminLegalDocument, "sections"> & { sections: DraftSection[] };

function toDraft(policy: AdminLegalDocument): Draft {
  return {
    ...policy,
    draftNote: policy.draftNote ?? "",
    sections: policy.sections.map((section) => ({
      heading: section.heading,
      paragraphsText: section.paragraphs?.join("\n\n") ?? "",
      bulletsText: section.bullets?.join("\n") ?? "",
    })),
  };
}

function fromFallback(document: LegalDocument): AdminLegalDocument {
  return { ...document, published: true };
}

function toPayload(draft: Draft): Omit<AdminLegalDocument, "slug" | "updatedAt"> {
  return {
    title: draft.title.trim(),
    shortTitle: draft.shortTitle.trim(),
    description: draft.description.trim(),
    effectiveDate: draft.effectiveDate.trim(),
    draftNote: draft.draftNote?.trim() ?? "",
    published: draft.published,
    sections: draft.sections.map((section) => ({
      heading: section.heading.trim(),
      paragraphs: section.paragraphsText.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean),
      bullets: section.bulletsText.split("\n").map((item) => item.replace(/^[-•]\s*/, "").trim()).filter(Boolean),
    })),
  };
}

const emptySection = (): DraftSection => ({ heading: "", paragraphsText: "", bulletsText: "" });

function AdminLegalContent() {
  const [selectedSlug, setSelectedSlug] = useState<LegalSlug>("cookies");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selectedDocument = legalDocuments.find((document) => document.slug === selectedSlug);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      setDraft(toDraft(await getAdminLegalDocument(selectedSlug)));
    } catch (reason) {
      if (selectedDocument) {
        setDraft(toDraft(fromFallback(selectedDocument)));
        setMessage("ยังไม่มีฉบับที่บันทึกไว้ จึงแสดงเนื้อหาตั้งต้นให้แก้ไขได้");
      } else {
        setDraft(null);
        setError(reason instanceof Error ? reason.message : "โหลดเอกสารไม่สำเร็จ");
      }
    } finally {
      setLoading(false);
    }
  }, [selectedDocument, selectedSlug]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const selectDocument = (slug: LegalSlug) => {
    if (slug === selectedSlug) return;
    setSelectedSlug(slug);
    setDraft(null);
    setMessage("");
    setError("");
  };

  const updateSection = (index: number, patch: Partial<DraftSection>) => {
    setDraft((current) => current ? {
      ...current,
      sections: current.sections.map((section, sectionIndex) => sectionIndex === index ? { ...section, ...patch } : section),
    } : current);
  };

  const save = async () => {
    if (!draft || draft.sections.length === 0) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = await updateAdminLegalDocument(selectedSlug, toPayload(draft));
      setDraft(toDraft(saved));
      setMessage(`บันทึก${saved.title}แล้ว`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "บันทึกเอกสารไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full min-w-0 bg-background">
        <SidebarNavigation />
        <div className="min-w-0 xl:pl-[var(--sidebar-width)]">
          <StudioHeader />
          <main className="page-gutter mx-auto w-full max-w-[1600px] py-5 lg:py-8">
            <div className="min-h-[calc(100vh-120px)] overflow-x-clip rounded-3xl bg-[#faf8f6] px-4 pb-20 sm:px-6 lg:px-8 lg:pb-24">
              <div className="mx-auto max-w-[1180px] pt-6 lg:pt-8">
                <div className="mb-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                  <div>
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#201d1b] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white"><FileText size={13} /> นโยบายและข้อกำหนด</div>
                    <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">จัดการนโยบายและข้อกำหนด</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">แก้ไขเอกสารที่แสดงในส่วนท้ายเว็บไซต์ และเผยแพร่ให้ผู้ใช้เข้าใจเงื่อนไขของบริการได้ง่ายขึ้น</p>
                  </div>
                  <Button variant="outline" size="lg" onClick={() => void load()} disabled={loading || busy}><RefreshCw size={16} className={loading ? "animate-spin" : undefined} /> โหลดข้อมูลใหม่</Button>
                </div>

                <div className="mb-6 grid gap-2 rounded-2xl border border-border bg-white p-2 sm:grid-cols-2 lg:grid-cols-5">
                  {legalDocuments.map((document) => (
                    <button key={document.slug} type="button" onClick={() => selectDocument(document.slug)} className={`rounded-xl px-3 py-3 text-left transition-colors ${document.slug === selectedSlug ? "bg-[#fff0e9] text-primary" : "text-muted-foreground hover:bg-[#faf8f6] hover:text-foreground"}`} aria-pressed={document.slug === selectedSlug}>
                      <span className="block truncate text-xs font-bold">{document.title}</span>
                      <span className="mt-1 block truncate text-[10px]">{document.shortTitle}</span>
                    </button>
                  ))}
                </div>

                {error ? <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#efc2c2] bg-[#fff6f6] p-4 text-sm text-[#9f3b3b]" role="alert"><AlertCircle size={18} className="mt-0.5 shrink-0" /><p>{error}</p></div> : null}
                {message ? <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[#bfe1cc] bg-[#f3fbf5] p-4 text-sm text-[#347454]" role="status"><CheckCircle2 size={18} /><p className="font-semibold">{message}</p></div> : null}

                {loading ? <div className="h-[560px] animate-pulse rounded-3xl border border-border bg-white" /> : draft ? (
                  <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
                    <div className="space-y-5">
                      <section className="rounded-2xl border border-border bg-white p-5 sm:p-6">
                        <div className="mb-5"><h2 className="text-base font-bold">ข้อมูลเอกสาร</h2><p className="mt-1 text-xs text-muted-foreground">ข้อมูลส่วนหัวที่จะแสดงบนหน้าเอกสารสาธารณะ</p></div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="text-xs font-semibold">ชื่อเอกสาร<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} maxLength={120} required className="mt-2 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-primary" /></label>
                          <label className="text-xs font-semibold">ชื่อสั้น<input value={draft.shortTitle} onChange={(event) => setDraft({ ...draft, shortTitle: event.target.value })} maxLength={80} required className="mt-2 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-primary" /></label>
                        </div>
                        <label className="mt-4 block text-xs font-semibold">คำอธิบาย<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} maxLength={500} required className="mt-2 min-h-20 w-full resize-y rounded-xl border border-border bg-white p-3 text-sm leading-6 outline-none focus:border-primary" /></label>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <label className="text-xs font-semibold">วันที่มีผล<input value={draft.effectiveDate} onChange={(event) => setDraft({ ...draft, effectiveDate: event.target.value })} maxLength={120} required className="mt-2 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-primary" /></label>
                          <label className="text-xs font-semibold">หมายเหตุฉบับร่าง <span className="font-normal text-muted-foreground">(ถ้ามี)</span><textarea value={draft.draftNote ?? ""} onChange={(event) => setDraft({ ...draft, draftNote: event.target.value })} maxLength={1000} className="mt-2 min-h-20 w-full resize-y rounded-xl border border-border bg-white p-3 text-sm leading-6 outline-none focus:border-primary" /></label>
                        </div>
                      </section>

                      <section className="rounded-2xl border border-border bg-white p-5 sm:p-6">
                        <div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="text-base font-bold">เนื้อหาเอกสาร</h2><p className="mt-1 text-xs text-muted-foreground">แยกย่อหน้าด้วยบรรทัดว่าง และแยกรายการด้วยการขึ้นบรรทัดใหม่</p></div><Button type="button" variant="outline" size="sm" onClick={() => setDraft({ ...draft, sections: [...draft.sections, emptySection()] })}><Plus size={15} /> เพิ่มหัวข้อ</Button></div>
                        <div className="space-y-4">
                          {draft.sections.map((section, index) => <article key={`section-${index}`} className="rounded-2xl border border-[#eaded6] bg-[#fcfaf8] p-4">
                            <div className="mb-3 flex items-center justify-between gap-3"><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">หัวข้อที่ {index + 1}</span><button type="button" onClick={() => setDraft({ ...draft, sections: draft.sections.filter((_, sectionIndex) => sectionIndex !== index) })} disabled={draft.sections.length === 1} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-white hover:text-[#bd3e3e] disabled:cursor-not-allowed disabled:opacity-40"><Trash2 size={13} /> ลบหัวข้อ</button></div>
                            <input value={section.heading} onChange={(event) => updateSection(index, { heading: event.target.value })} maxLength={180} required placeholder="เช่น 1. คุกกี้คืออะไร" className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm font-semibold outline-none focus:border-primary" />
                            <label className="mt-3 block text-xs font-semibold">ย่อหน้า<textarea value={section.paragraphsText} onChange={(event) => updateSection(index, { paragraphsText: event.target.value })} placeholder="พิมพ์เนื้อหาแต่ละย่อหน้า..." className="mt-2 min-h-24 w-full resize-y rounded-xl border border-border bg-white p-3 text-sm leading-6 outline-none focus:border-primary" /></label>
                            <label className="mt-3 block text-xs font-semibold">รายการหัวข้อย่อย <span className="font-normal text-muted-foreground">(หนึ่งรายการต่อหนึ่งบรรทัด)</span><textarea value={section.bulletsText} onChange={(event) => updateSection(index, { bulletsText: event.target.value })} placeholder={'คุกกี้ที่จำเป็น\nคุกกี้การตั้งค่า'} className="mt-2 min-h-20 w-full resize-y rounded-xl border border-border bg-white p-3 text-sm leading-6 outline-none focus:border-primary" /></label>
                          </article>)}
                        </div>
                      </section>
                    </div>

                    <aside className="space-y-5">
                      <section className="rounded-2xl border border-border bg-white p-5 sm:p-6"><h2 className="text-base font-bold">การเผยแพร่</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">เมื่อเปิดเผยแพร่ ผู้ใช้จะเห็นเอกสารฉบับนี้ที่หน้าสาธารณะ</p><button type="button" onClick={() => setDraft({ ...draft, published: !draft.published })} className={`mt-4 flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left text-xs font-semibold ${draft.published ? "border-[#bfe1cc] bg-[#f3fbf5] text-[#347454]" : "border-border bg-white text-muted-foreground"}`} aria-pressed={draft.published}><span><b>{draft.published ? "เผยแพร่แล้ว" : "ซ่อนเอกสาร"}</b><small className="mt-1 block font-normal">{draft.published ? "หน้าเว็บสาธารณะใช้เนื้อหานี้" : "ผู้ใช้จะเห็นฉบับสำรองเดิม"}</small></span><span className={`flex h-5 w-5 items-center justify-center rounded-full border ${draft.published ? "border-[#4c9b72] bg-[#4c9b72] text-white" : "border-border"}`}>{draft.published ? "✓" : null}</span></button><Button type="submit" className="mt-4 w-full" disabled={busy || !draft.title.trim() || !draft.shortTitle.trim() || !draft.effectiveDate.trim() || draft.sections.some((section) => !section.heading.trim())}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}{busy ? "กำลังบันทึก..." : "บันทึกเอกสาร"}</Button></section>
                      <section className="rounded-2xl border border-[#eaded6] bg-[#fff8f4] p-5"><h2 className="text-sm font-bold">ตรวจสอบหน้าเว็บ</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">เปิดหน้าเผยแพร่เพื่อดูผลลัพธ์หลังบันทึก</p><Link href={`/legal/${selectedSlug}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-bold text-primary hover:underline">เปิดหน้า {draft.title} ↗</Link></section>
                      {draft.updatedAt ? <p className="px-1 text-[10px] text-muted-foreground">แก้ไขล่าสุด: {new Date(draft.updatedAt).toLocaleString("th-TH")}</p> : null}
                    </aside>
                  </form>
                ) : null}
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function AdminLegalPage() {
  return <AdminLegalContent />;
}
