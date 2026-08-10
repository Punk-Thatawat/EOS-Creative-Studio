import { LayoutTemplate, Plus } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Templates" };
export default function TemplatesPage() { return <><PageHeader eyebrow="Workspace" title="Templates" description="Reusable creative directions for consistent, faster work." action={<Button><Plus size={17} /> New template</Button>} /><EmptyState icon={LayoutTemplate} title="Your template library is waiting" description="Save your best prompts and settings as templates your whole team can use." action="Create a template" /></> }
