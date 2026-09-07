"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getTemplate, type CreativeTemplate, type TemplateKind } from "@/lib/api/templates";
export function useTemplateSettings(kind: TemplateKind, options: {
  ready: boolean; model: string; models: string[]; setModel: (model: string)=>void;
  apply: (settings: Record<string,unknown>, prompt: string)=>void;
}) {
  const slug = useSearchParams().get('template');
  const [template,setTemplate] = useState<CreativeTemplate|null>(null);
  const applied = useRef<string|null>(null);
  const current = useRef(options);
  useEffect(()=>{current.current=options;});
  useEffect(()=>{
    if(!slug)return;
    let active=true;
    void getTemplate(slug).then(t=>{if(active)setTemplate(t);}).catch(()=>{});
    return()=>{active=false;};
  },[slug]);
  useEffect(()=>{
    if(!slug||!template||template.slug!==slug||template.kind!==kind||!options.ready||applied.current===slug)return;
    const settings=template.settings??{};
    const model=typeof settings.model==='string'?settings.model:typeof settings.modelId==='string'?settings.modelId:'';
    if(model&&!current.current.models.includes(model)) {
      applied.current=slug; current.current.setModel('');
      window.alert('โมเดลในเทมเพลตนี้ไม่พร้อมใช้งาน กรุณาเลือกโมเดลใหม่ก่อนสร้างงาน'); return;
    }
    if(model&&options.model!==model){current.current.setModel(model);return;}
    applied.current=slug;
    current.current.apply(settings,template.prompt);
  },[slug,template,kind,options.ready,options.model]);
}
