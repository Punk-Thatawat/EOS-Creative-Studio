"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { GenerationKind } from "../types/generation";

const generationSchema = z.object({ prompt: z.string().min(3, "Add a little more direction to your prompt.").max(1000), model: z.string().min(1), aspectRatio: z.string().min(1) });
type GenerationValues = z.infer<typeof generationSchema>;

export function GenerationForm({ kind }: { kind: Exclude<GenerationKind, "image"> }) {
  const { register, handleSubmit, formState: { errors } } = useForm<GenerationValues>({ resolver: zodResolver(generationSchema), defaultValues: { model: "eos-preview", aspectRatio: "1:1" } });
  const onSubmit = (values: GenerationValues) => { void values; };

  return <form onSubmit={handleSubmit(onSubmit)}><Card><CardHeader><div><h3 className="font-bold">Describe your idea</h3><p className="mt-1 text-xs text-muted-foreground">Your request will be validated and connected to a provider in a later phase.</p></div><span className="rounded-full bg-[#fff0e9] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">Preview</span></CardHeader><CardContent className="space-y-5"><div><label htmlFor="prompt" className="mb-2 block text-sm font-bold">Prompt</label><textarea id="prompt" {...register("prompt")} placeholder={`Describe the ${kind.replace("-", " ")} you want to create...`} className="min-h-36 w-full resize-y rounded-xl border border-border bg-[#fcfbfa] p-3 text-sm outline-none transition focus:border-primary" />{errors.prompt ? <p className="mt-1 text-xs text-destructive">{errors.prompt.message}</p> : null}</div><div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="model" className="mb-2 block text-sm font-bold">Model</label><select id="model" {...register("model")} className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm"><option value="eos-preview">EOS Preview Model</option><option value="coming-soon">More models coming soon</option></select></div><div><label htmlFor="aspectRatio" className="mb-2 block text-sm font-bold">Aspect ratio</label><select id="aspectRatio" {...register("aspectRatio")} className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm"><option value="1:1">Square · 1:1</option><option value="16:9">Landscape · 16:9</option><option value="9:16">Portrait · 9:16</option></select></div></div><div className="flex flex-col justify-between gap-3 border-t border-border pt-5 sm:flex-row sm:items-center"><p className="text-xs text-muted-foreground">Estimated cost will appear once pricing is configured.</p><Button type="submit">Save generation brief</Button></div></CardContent></Card></form>;
}
