import { Filter, ImageIcon, Search } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Assets" };
export default function AssetsPage() { return <><PageHeader eyebrow="Library" title="Assets" description="Everything your workspace has created, in one searchable library." action={<div className="flex gap-2"><Button variant="outline"><Filter size={15} /> Filter</Button><Button><Search size={15} /> Search assets</Button></div>} /><EmptyState icon={ImageIcon} title="No assets to show yet" description="Create an image, video, presenter, or audio brief and your generated assets will appear here." action="Start creating" /></> }
