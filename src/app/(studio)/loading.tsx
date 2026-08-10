import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return <div className="space-y-6"><Skeleton className="h-8 w-56" /><Skeleton className="h-4 w-96" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div><Skeleton className="h-80" /></div>;
}
