import { notFound } from "next/navigation";

// Scaffold page with a sample palette only. It is not linked anywhere, so it answers 404
// until it is backed by real brand data.
export default function BrandKitPage(): never {
  notFound();
}
