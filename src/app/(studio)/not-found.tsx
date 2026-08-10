import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return <div className="flex min-h-[60vh] flex-col items-center justify-center text-center"><div className="mb-4 rounded-2xl bg-[#f9e5eb] p-3 text-[#ae5572]"><FileQuestion size={24} /></div><h2 className="text-xl font-bold">We could not find that page</h2><p className="mt-2 text-sm text-muted-foreground">The page or project may have been moved.</p><Link href="/dashboard" className="mt-5"><Button>Back to dashboard</Button></Link></div>;
}
