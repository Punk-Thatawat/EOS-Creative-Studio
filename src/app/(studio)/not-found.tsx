"use client";

import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudioCopy } from "@/lib/i18n/studio-copy";

export default function NotFound() {
  const { c } = useStudioCopy();
  return <div className="flex min-h-[60vh] flex-col items-center justify-center text-center"><div className="mb-4 rounded-2xl bg-[#f9e5eb] p-3 text-[#ae5572]"><FileQuestion size={24} /></div><h2 className="text-xl font-bold">{c("common.notFound.title")}</h2><p className="mt-2 text-sm text-muted-foreground">{c("common.notFound.body")}</p><Link href="/dashboard" className="mt-5"><Button>{c("common.notFound.back")}</Button></Link></div>;
}
