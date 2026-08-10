import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ForbiddenPage() { return <div className="flex min-h-[60vh] flex-col items-center justify-center text-center"><div className="mb-4 rounded-2xl bg-[#fff3cc] p-3 text-[#a67c17]"><ShieldAlert size={24} /></div><h2 className="text-xl font-bold">You do not have access</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">Your workspace membership does not allow this action or resource.</p><Link href="/dashboard" className="mt-5"><Button>Back to dashboard</Button></Link></div> }
