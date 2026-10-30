import { notFound } from "next/navigation";

// Scaffold page that showed the same sample project for any id. Answer 404 until projects
// are backed by real data.
export default function ProjectPage(): never {
  notFound();
}
