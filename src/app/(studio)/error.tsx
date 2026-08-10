"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StudioError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="flex min-h-[60vh] flex-col items-center justify-center text-center"><div className="mb-4 rounded-2xl bg-[#fff3cc] p-3 text-[#a67c17]"><AlertTriangle size={24} /></div><h2 className="text-xl font-bold">Something went wrong</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">We could not load this workspace view. Try again, or return to the dashboard.</p><Button className="mt-5" onClick={reset}>Try again</Button></div>;
}
