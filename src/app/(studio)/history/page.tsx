import { History } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "History" };
export default function HistoryPage() { return <><PageHeader eyebrow="Workspace" title="History" description="A clear record of your team’s creative activity and generation jobs." /><EmptyState icon={History} title="Your activity history is clear" description="Generation events, project updates, and team activity will be recorded here." /></> }
