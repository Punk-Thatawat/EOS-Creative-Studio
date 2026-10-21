import { notFound } from "next/navigation";

// Scaffold page with sample projects only. It is not linked anywhere, so it answers 404
// until it is backed by real project data.
export default function ProjectsPage(): never {
  notFound();
}
