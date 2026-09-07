"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, AudioLines, Expand, Search, X } from "lucide-react";
import { listTemplates, type CreativeTemplate as Template, type TemplateKind, type TemplatePagination } from "@/lib/api/templates";
import s from "./templates-page.module.css";
import { templateCopy } from './template-copy';
const kinds = { all:"ทั้งหมด", image:"ภาพ", video:"วิดีโอ", audio:"เสียง", document:"เอกสาร" };
const titles: Record<string,string> = {"Social media post":"โพสต์โซเชียลที่เป็นคุณ","Product ad":"เปลี่ยนสินค้าให้เป็นแคมเปญ","AI presenter video":"พรีเซนเตอร์ AI มืออาชีพ","Podcast & dialogue":"พอดแคสต์และบทสนทนา","Training video":"วิดีโออบรมและสอน"};
const copy = (t:Template) => templateCopy(t.title,t.description,typeof t.settings?.feature==='string'?t.settings.feature:undefined,t.kind);
const name = (t:Template) => titles[t.title] ?? copy(t).title;
function templateHref(t:Template) { const url = new URL(t.targetPath, "http://template.local"); url.searchParams.set("template", t.slug); return url.pathname + url.search + url.hash; }
const valid = (v?:string) => !!v && !v.includes("\\") && (/^\/(?!\/)/.test(v) || /^https?:\/\//i.test(v));
function Media({t,expanded=false}:{t:Template;expanded?:boolean}) {
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
 const poster=imageError||!valid(t.thumbnailUrl)?<span className={s.missing}>โหลดภาพปกไม่ได้</span>:<Image src={t.thumbnailUrl} alt={expanded?name(t):""} fill unoptimized sizes="(max-width:700px) 100vw, 65vw" className={s.poster} onError={()=>setImageError(true)}/>;
 if(t.kind==="video"&&playable)return <video ref={el=>{ref.current=el;}} src={t.previewUrl} poster={t.thumbnailUrl} className={s.video} controls muted loop playsInline preload="metadata" aria-label={"วิดีโอตัวอย่าง "+name(t)} onError={()=>setFailed(true)}/>;
 if(t.kind==="audio")return <div className={s.audio}><div className={s.audioCover}>{poster}</div><div className={s.audioPlayer}><AudioLines size={36}/><strong>{name(t)}</strong>{playable?<audio ref={el=>{ref.current=el;}} src={t.previewUrl} controls preload="metadata" aria-label={"ฟังตัวอย่าง "+name(t)} onError={()=>setFailed(true)}/>:<span>{failed?"โหลดเสียงไม่ได้":"ยังไม่มีไฟล์เสียงตัวอย่าง"}</span>}</div></div>;
 return <div className={s.still}>{poster}{t.kind==="video"&&<span className={s.noPreview}>{failed?"โหลดวิดีโอไม่ได้":"ยังไม่มีวิดีโอตัวอย่าง"}</span>}</div>;
}
function Card({t,lead=false,preview}:{t:Template;lead?:boolean;preview:(t:Template)=>void}) {
 return <article className={[s.card,lead?s.lead:"",t.kind==="audio"||t.kind==="video"&&valid(t.previewUrl)?s.mediaCard:""].join(" ")}><div className={s.visual}><Media t={t} key={t.id+t.previewUrl}/><span className={s.kind}>{kinds[t.kind]}</span><button className={s.expand} onClick={()=>preview(t)} aria-label={"ดูตัวอย่าง "+name(t)}><Expand size={18}/></button></div><div className={s.caption}><div><h2>{name(t)}</h2><p>{t.category} · {t.format}</p></div><div className={s.actions}><button className={s.preview} onClick={()=>preview(t)}>ดูตัวอย่าง</button>{valid(t.targetPath)&&t.targetPath.startsWith("/")&&<Link href={templateHref(t)} className={s.use}>ใช้เทมเพลต <ArrowRight size={17}/></Link>}</div></div></article>;
}
function Preview({t,close}:{t:Template;close:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
   const el=ref.current, overflow=document.body.style.overflow;
   el?.showModal(); document.body.style.overflow="hidden";
   document.querySelectorAll<HTMLMediaElement>("video,audio").forEach(m=>m.pause());
   return()=>{el?.close();document.body.style.overflow=overflow;};
 },[]);
 const settings=t.settings??{};
 const facts:[string,unknown][]=[["โมเดล",settings.model??settings.modelId],["สัดส่วน",settings.ratio??settings.aspectRatio],["ความละเอียด",settings.resolution],["จำนวน",settings.count],["ระยะเวลา",typeof settings.duration==="number"?settings.duration+" วินาที":undefined],["ไฟล์",settings.outputFormat]];
 return <dialog ref={ref} className={`${s.dialog} ${s.previewDialog}`} onCancel={close} onClick={e=>{if(e.target===ref.current)close();}} aria-labelledby="template-preview-title">
   <button className={s.previewClose} onClick={close} aria-label="ปิดตัวอย่าง"><X size={20}/></button>
   <div className={s.previewLayout}>
     <div className={s.artworkPane}><Media t={t} expanded/><span className={s.artworkLabel}>EOS / CREATIVE STUDIO</span></div>
     <section className={s.previewInfo}>
       <span className={s.previewEyebrow}>{kinds[t.kind]} · TEMPLATE</span>
       <h2 id="template-preview-title">{name(t)}</h2>
       <p className={s.previewDescription}>{copy(t).description}</p>
       <div className={s.presetHeading}>เริ่มต้นด้วยชุดค่านี้</div>
       <dl className={s.presetFacts}>{facts.filter(([,v])=>typeof v==="string"||typeof v==="number").map(([label,value])=><div key={label}><dt>{label}</dt><dd>{String(value)}</dd></div>)}</dl>
       {!facts.some(([,v])=>typeof v==="string"||typeof v==="number")&&<p className={s.previewDescription}>ปรับแต่งการตั้งค่าเพิ่มเติมได้ในหน้าสร้างงาน</p>}
       <div className={s.previewFooter}>
         {valid(t.targetPath)&&t.targetPath.startsWith("/")&&<Link href={templateHref(t)} className={s.use}>ใช้เทมเพลตนี้ <ArrowRight size={19}/></Link>}
         <p>ดูตัวอย่างฟรี · ยังไม่หักเครดิต<br/>ตรวจค่าก่อนกด Generate ในหน้าถัดไป</p>
       </div>
     </section>
   </div>
 </dialog>;
}
export function TemplatesPageClient(){
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
 return <div className={s.page} data-page="templates" data-no-translate><h1>ไอเดียที่ใช่ เริ่มได้ทันที</h1>{!loading&&!error&&featured.length>0&&<section className={s.featured} aria-label="เทมเพลตแนะนำ">{featured.map((t,i)=><Card key={t.id} t={t} lead={i===0} preview={setPreview}/>)}</section>}
 <section className={s.filters} aria-label="ค้นหาและกรองเทมเพลต"><label className={s.search}><Search size={18}/><input type="search" value={q} placeholder="ค้นหาชื่อ หมวดหมู่ หรือแท็ก…" aria-label="ค้นหาเทมเพลต" onChange={e=>{setQ(e.target.value);change();}}/></label><div className={s.types}>{Object.entries(kinds).map(([v,label])=><button key={v} aria-pressed={kind===v} onClick={()=>{if(kind===v)return;setKind(v as typeof kind);change();}}>{label}</button>)}</div><select aria-label="หมวดหมู่" value={category} onChange={e=>{setCategory(e.target.value);change();}}><option value="all">ทุกหมวดหมู่</option>{categories.map(c=><option key={c}>{c}</option>)}</select><select aria-label="เรียงเทมเพลต" value={sort} onChange={e=>{setSort(e.target.value as typeof sort);change();}}><option value="recommended">แนะนำ</option><option value="newest">ล่าสุด</option></select>{filtered&&<button onClick={reset}>ล้างตัวกรอง</button>}</section>
 {loading?<div role="status" className={s.empty}>กำลังโหลดเทมเพลต…</div>:error?<div role="alert" className={s.empty}>โหลดเทมเพลตไม่สำเร็จ <button onClick={()=>setRetry(n=>n+1)}>ลองอีกครั้ง</button></div>:<><p className={s.count} role="status">{pagination.total} เทมเพลต · หน้า {pagination.page} / {pagination.totalPages}</p>{!items.length?<div className={s.empty}><h2>ไม่พบเทมเพลต</h2><p>ลองค้นหาด้วยคำอื่น หรือเลือกหมวดหมู่อื่น</p><button onClick={reset}>ดูเทมเพลตทั้งหมด</button></div>:<section className={s.library} aria-label="คลังเทมเพลต">{library.map(t=><Card key={t.id} t={t} preview={setPreview}/>)}</section>}{pagination.totalPages>1&&<nav className={s.pagination} aria-label="หน้าเทมเพลต"><button disabled={pagination.page===1} onClick={()=>{setPage(pagination.page-1);setLoading(true);}}>ก่อนหน้า</button>{pages.map((n,i)=><span key={n}>{i>0&&n-pages[i-1]>1&&<span>…</span>}<button aria-current={n===pagination.page?"page":undefined} onClick={()=>{if(n===pagination.page)return;setPage(n);setLoading(true);}}>{n}</button></span>)}<button disabled={pagination.page===pagination.totalPages} onClick={()=>{setPage(pagination.page+1);setLoading(true);}}>ถัดไป</button></nav>}</>}
 {preview&&<Preview t={preview} close={()=>setPreview(null)}/>}</div>;
}
