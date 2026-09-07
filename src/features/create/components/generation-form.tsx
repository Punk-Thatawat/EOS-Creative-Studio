"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { GenerationKind } from "../types/generation";
import { useLocale } from "@/lib/i18n/locale-provider";

type GenerationValues = { prompt: string; model: string; aspectRatio: string };

export function GenerationForm({ kind }: { kind: Exclude<GenerationKind, "image"> }) {
  const { t } = useLocale();
  const generationSchema = z.object({ prompt: z.string().min(3, t("create.promptMoreDirection")).max(1000), model: z.string().min(1), aspectRatio: z.string().min(1) });
  const { register, handleSubmit, formState: { errors } } = useForm<GenerationValues>({ resolver: zodResolver(generationSchema), defaultValues: { model: "eos-preview", aspectRatio: "1:1" } });
  const onSubmit = (values: GenerationValues) => { void values; };

  return <form onSubmit={handleSubmit(onSubmit)}><Card><CardHeader><div><h3 className="font-bold">{t("create.describeIdea")}</h3><p className="mt-1 text-xs text-muted-foreground">{t("create.providerNotice")}</p></div><span className="rounded-full bg-[#fff0e9] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">{t("create.preview")}</span></CardHeader><CardContent className="space-y-5"><div><label htmlFor="prompt" className="mb-2 block text-sm font-bold">{t("create.prompt")}</label><textarea id="prompt" {...register("prompt")} placeholder={t("create.promptPlaceholder", { kind: kind.replace("-", " ") })} className="min-h-36 w-full resize-y rounded-xl border border-border bg-[#fcfbfa] p-3 text-sm outline-none transition focus:border-primary" />{errors.prompt ? <p className="mt-1 text-xs text-destructive">{errors.prompt.message}</p> : null}</div><div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="model" className="mb-2 block text-sm font-bold">{t("create.model")}</label><select id="model" {...register("model")} className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm"><option value="eos-preview">{t("create.eosPreviewModel")}</option><option value="coming-soon">{t("create.moreModels")}</option></select></div><div><label htmlFor="aspectRatio" className="mb-2 block text-sm font-bold">{t("create.aspectRatio")}</label><select id="aspectRatio" {...register("aspectRatio")} className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm"><option value="1:1">{t("create.square")}</option><option value="16:9">{t("create.landscape")}</option><option value="9:16">{t("create.portrait")}</option></select></div></div><div className="flex flex-col justify-between gap-3 border-t border-border pt-5 sm:flex-row sm:items-center"><p className="text-xs text-muted-foreground">{t("create.estimatedCost")}</p><Button type="submit">{t("create.saveBrief")}</Button></div></CardContent></Card></form>;
}
