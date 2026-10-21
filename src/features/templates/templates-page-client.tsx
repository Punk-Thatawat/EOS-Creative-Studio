"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, AudioLines, Expand, X } from "lucide-react";
import { listTemplates, type CreativeTemplate as Template, type TemplateKind, type TemplatePagination } from "@/lib/api/templates";
import s from "./templates-page.module.css";
import { SearchInput } from "@/components/ui/search-input";
import { templateCopy } from './template-copy';
import { useStudioCopy, type StudioCopyKey } from "@/lib/i18n/studio-copy";
const kindKeys: Record<TemplateKind | "all", StudioCopyKey> = { all:"templates.kind.all", image:"templates.kind.image", video:"templates.kind.video", audio:"templates.kind.audio", document:"templates.kind.document" };
type CopyLocale = "th" | "en";
const titles: Record<string,string> = {"Social media post":"โพสต์โซเชียลที่เป็นคุณ","Product ad":"เปลี่ยนสินค้าให้เป็นแคมเปญ","AI presenter video":"พรีเซนเตอร์ AI มืออาชีพ","Podcast & dialogue":"พอดแคสต์และบทสนทนา","Training video":"วิดีโออบรมและสอน"};
const copy = (t:Template, locale:CopyLocale) => templateCopy(t.title,t.description,typeof t.settings?.feature==='string'?t.settings.feature:undefined,t.kind,locale);
// The Thai names for the seeded English templates only make sense in Thai; other titles come from the data.
const name = (t:Template, locale:CopyLocale) => (locale === "th" ? titles[t.title] : undefined) ?? copy(t, locale).title;
function templateHref(t:Template) { const url = new URL(t.targetPath, "http://template.local"); url.searchParams.set("template", t.slug); return url.pathname + url.search + url.hash; }
const valid = (v?:string) => !!v && !v.includes("\\") && (/^\/(?!\/)/.test(v) || /^https?:\/\//i.test(v));
function Media({t,expanded=false}:{t:Template;expanded?:boolean}) {
 const {c,locale}=useStudioCopy();
 const ref=useRef<HTMLMediaElement|null>(null), [failed,setFailed]=useState(false), [imageError,setImageError]=useState(false);
 const playable=valid(t.previewUrl)&&!failed;
 useEffect(()=>{
  const el=ref.current;if(!el)return;
  const other=(e:Event)=>{if((e as CustomEvent).detail!==el)el.pause();};
  const claim=()=>{if(!el.muted&&!el.paused)window.dispatchEvent(new CustomEvent("template-audio",{detail:el}));};
  const hidden=()=>{if(document.hidden)el.pause();};
  window.addEventListener("template-audio",other);el.addEventListener("play",claim);el.addEventListener("volumechange",claim);document.addEventListener("visibilitychange",hidden);
  const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
  const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(!entry.isIntersecting)el.pause();else if(t.kind==="video"&&!expanded&&!reduced&&el.muted&&!document.hidden)void el.play().catch(()=>{});});},{threshold:.55});
  observer.observe(el);return()=>{observer.disconnect();el.pause();window.removeEventListener("template-audio",other);el.removeEventListener("play",claim);el.removeEventListener("volumechange",claim);document.removeEventListener("visibilitychange",hidden);};
 },[t.previewUrl,t.kind,expanded,playable]);
 const poster=imageError||!valid(t.thumbnailUrl)?<span className={s.missing}>{c("templates.media.coverFailed")}</span>:<Image src={t.thumbnailUrl} alt={expanded?name(t,locale):""} fill unoptimized sizes="(max-width:700px) 100vw, 65vw" className={s.poster} onError={()=>setImageError(true)}/>;
 if(t.kind==="video"&&playable)return <video ref={el=>{ref.current=el;}} src={t.previewUrl} poster={t.thumbnailUrl} className={s.video} controls muted loop playsInline preload="metadata" aria-label={c("templates.media.videoAria",{name:name(t,locale)})} onError={()=>setFailed(true)}/>;
 if(t.kind==="audio")return <div className={s.audio}><div className={s.audioCover}>{poster}</div><div className={s.audioPlayer}><AudioLines size={36}/><strong>{name(t,locale)}</strong>{playable?<audio ref={el=>{ref.current=el;}} src={t.previewUrl} controls preload="metadata" aria-label={c("templates.media.audioAria",{name:name(t,locale)})} onError={()=>setFailed(true)}/>:<span>{failed?c("templates.media.audioFailed"):c("templates.media.audioMissing")}</span>}</div></div>;
 return <div className={s.still}>{poster}{t.kind==="video"&&<span className={s.noPreview}>{failed?c("templates.media.videoFailed"):c("templates.media.videoMissing")}</span>}</div>;
}
function Card({t,lead=false,preview}:{t:Template;lead?:boolean;preview:(t:Template)=>void}) {
 const {c,locale}=useStudioCopy();
 return <article className={[s.card,lead?s.lead:"",t.kind==="audio"||t.kind==="video"&&valid(t.previewUrl)?s.mediaCard:""].join(" ")}><div className={s.visual}><Media t={t} key={t.id+t.previewUrl}/><span className={s.kind}>{c(kindKeys[t.kind])}</span><button className={s.expand} onClick={()=>preview(t)} aria-label={c("templates.card.previewAria",{name:name(t,locale)})}><Expand size={18}/></button></div><div className={s.caption}><div><h2>{name(t,locale)}</h2><p>{t.category} · {t.format}</p></div><div className={s.actions}><button className={s.preview} onClick={()=>preview(t)}>{c("templates.card.preview")}</button>{valid(t.targetPath)&&t.targetPath.startsWith("/")&&<Link href={templateHref(t)} className={s.use}>{c("templates.card.use")} <ArrowRight size={17}/></Link>}</div></div></article>;
}
function Preview({t,close}:{t:Template;close:()=>void}){
 const {c,locale}=useStudioCopy();
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
   const el=ref.current, overflow=document.body.style.overflow;
   el?.showModal(); document.body.style.overflow="hidden";
   document.querySelectorAll<HTMLMediaElement>("video,audio").forEach(m=>m.pause());
   return()=>{el?.close();document.body.style.overflow=overflow;};
 },[]);
 const settings=t.settings??{};
 const facts:[string,unknown][]=[[c("templates.preview.factModel"),settings.model??settings.modelId],[c("templates.preview.factRatio"),settings.ratio??settings.aspectRatio],[c("templates.preview.factResolution"),settings.resolution],[c("templates.preview.factCount"),settings.count],[c("templates.preview.factDuration"),typeof settings.duration==="number"?c("templates.preview.seconds",{value:settings.duration}):undefined],[c("templates.preview.factFile"),settings.outputFormat]];
 return <dialog ref={ref} className={`${s.dialog} ${s.previewDialog}`} onCancel={close} onClick={e=>{if(e.target===ref.current)close();}} aria-labelledby="template-preview-title">
   <button className={s.previewClose} onClick={close} aria-label={c("templates.preview.close")}><X size={20}/></button>
   <div className={s.previewLayout}>
     <div className={s.artworkPane}><Media t={t} expanded/><span className={s.artworkLabel}>EOS / CREATIVE STUDIO</span></div>
     <section className={s.previewInfo}>
       <span className={s.previewEyebrow}>{c(kindKeys[t.kind])} · TEMPLATE</span>
       <h2 id="template-preview-title">{name(t,locale)}</h2>
       <p className={s.previewDescription}>{copy(t,locale).description}</p>
       <div className={s.presetHeading}>{c("templates.preview.presetHeading")}</div>
       <dl className={s.presetFacts}>{facts.filter(([,v])=>typeof v==="string"||typeof v==="number").map(([label,value])=><div key={label}><dt>{label}</dt><dd>{String(value)}</dd></div>)}</dl>
       {!facts.some(([,v])=>typeof v==="string"||typeof v==="number")&&<p className={s.previewDescription}>{c("templates.preview.noFacts")}</p>}
       <div className={s.previewFooter}>
         {valid(t.targetPath)&&t.targetPath.startsWith("/")&&<Link href={templateHref(t)} className={s.use}>{c("templates.preview.useThis")} <ArrowRight size={19}/></Link>}
         <p>{c("templates.preview.footerLine1")}<br/>{c("templates.preview.footerLine2")}</p>
       </div>
     </section>
   </div>
 </dialog>;
}
export function TemplatesPageClient(){
 const {c}=useStudioCopy();
 const [items,setItems]=useState<Template[]>([]),[categories,setCategories]=useState<string[]>([]);
 const [q,setQ]=useState(""),[kind,setKind]=useState<TemplateKind|"all">("all"),[category,setCategory]=useState("all"),[sort,setSort]=useState<"recommended"|"newest">("recommended"),[page,setPage]=useState(1);
 const [pagination,setPagination]=useState<TemplatePagination>({page:1,limit:12,total:0,totalPages:1}),[loading,setLoading]=useState(true),[error,setError]=useState(false),[retry,setRetry]=useState(0),[preview,setPreview]=useState<Template|null>(null);
 useEffect(()=>{const c=new AbortController();const timer=setTimeout(()=>{setLoading(true);setError(false);listTemplates({search:q,kind,category,sort,page,limit:12,signal:c.signal}).then(r=>{if(c.signal.aborted)return;setItems(r.templates);setCategories(r.categories);setPagination(r.pagination??{page:1,limit:12,total:r.templates.length,totalPages:1});}).catch(()=>{if(!c.signal.aborted)setError(true);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});},q?250:0);return()=>{c.abort();clearTimeout(timer);};},[q,kind,category,sort,page,retry]);
 const filtered=!!q.trim()||kind!=="all"||category!=="all"||sort!=="recommended";
 const featured=!filtered&&pagination.page===1?items.filter(t=>t.featured).slice(0,3):[];
 const library=items.filter(t=>!featured.some(f=>f.id===t.id));
 const change=()=>{setPage(1);setLoading(true);};
 const reset=()=>{setQ("");setKind("all");setCategory("all");setSort("recommended");setRetry(n=>n+1);change();};
 const pages=[...new Set([1,...Array.from({length:5},(_,i)=>pagination.page+i-2),pagination.totalPages])].filter(n=>n>0&&n<=pagination.totalPages).sort((a,b)=>a-b);
 return <div className={s.page} data-page="templates" data-no-translate><h1>{c("templates.heading")}</h1>{!loading&&!error&&featured.length>0&&<section className={s.featured} aria-label={c("templates.featuredAria")}>{featured.map((t,i)=><Card key={t.id} t={t} lead={i===0} preview={setPreview}/>)}</section>}
 <section className={s.filters} aria-label={c("templates.filtersAria")}><SearchInput className="w-full min-w-[230px] flex-1" value={q} onValueChange={value=>{setQ(value);change();}} placeholder={c("templates.searchPlaceholder")} aria-label={c("templates.searchAria")} /><div className={s.types}>{(Object.keys(kindKeys) as Array<TemplateKind|"all">).map(v=><button key={v} aria-pressed={kind===v} onClick={()=>{if(kind===v)return;setKind(v as typeof kind);change();}}>{c(kindKeys[v])}</button>)}</div><select aria-label={c("templates.categoryAria")} value={category} onChange={e=>{setCategory(e.target.value);change();}}><option value="all">{c("templates.allCategories")}</option>{categories.map(c=><option key={c}>{c}</option>)}</select><select aria-label={c("templates.sortAria")} value={sort} onChange={e=>{setSort(e.target.value as typeof sort);change();}}><option value="recommended">{c("templates.sortRecommended")}</option><option value="newest">{c("templates.sortNewest")}</option></select>{filtered&&<button onClick={reset}>{c("templates.clearFilters")}</button>}</section>
 {loading?<div role="status" className={s.empty}>{c("templates.loading")}</div>:error?<div role="alert" className={s.empty}>{c("templates.loadFailed")} <button onClick={()=>setRetry(n=>n+1)}>{c("templates.retry")}</button></div>:<><p className={s.count} role="status">{c("templates.count",{total:pagination.total,page:pagination.page,pages:pagination.totalPages})}</p>{!items.length?<div className={s.empty}><h2>{c("templates.emptyTitle")}</h2><p>{c("templates.emptyBody")}</p><button onClick={reset}>{c("templates.showAll")}</button></div>:<section className={s.library} aria-label={c("templates.libraryAria")}>{library.map(t=><Card key={t.id} t={t} preview={setPreview}/>)}</section>}{pagination.totalPages>1&&<nav className={s.pagination} aria-label={c("templates.paginationAria")}><button disabled={pagination.page===1} onClick={()=>{setPage(pagination.page-1);setLoading(true);}}>{c("templates.prev")}</button>{pages.map((n,i)=><span key={n}>{i>0&&n-pages[i-1]>1&&<span>…</span>}<button aria-current={n===pagination.page?"page":undefined} onClick={()=>{if(n===pagination.page)return;setPage(n);setLoading(true);}}>{n}</button></span>)}<button disabled={pagination.page===pagination.totalPages} onClick={()=>{setPage(pagination.page+1);setLoading(true);}}>{c("templates.next")}</button></nav>}</>}
 {preview&&<Preview t={preview} close={()=>setPreview(null)}/>}</div>;
}
