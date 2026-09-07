"use client";
import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { getTemplate, type TemplateKind } from "@/lib/api/templates";

/** Read-only initialization: never submits a generation or debits credits. */
export function useTemplatePrompt(kind: TemplateKind, apply: (prompt: string) => void) {
  const slug = useSearchParams().get("template");
  const callback = useRef(apply);
  useEffect(() => { callback.current = apply; }, [apply]);
  useEffect(() => {
    if (!slug) return;
    let active = true;
    void getTemplate(slug).then(template => {
      if (active && template.kind === kind) callback.current(template.prompt);
    }).catch(() => {
      if (active) window.alert("โหลด prompt ของเทมเพลตไม่สำเร็จ กรุณากลับไปเลือกเทมเพลตอีกครั้ง");
    });
    return () => { active = false; };
  }, [slug, kind]);
}
