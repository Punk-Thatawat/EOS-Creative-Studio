import { notFound } from "next/navigation";

// Scaffold page with sample members only. It is not linked anywhere, so it answers 404
// until it is backed by real workspace data.
export default function TeamPage(): never {
  notFound();
}
