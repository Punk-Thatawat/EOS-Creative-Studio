import type { ReactNode } from "react";
import { AuthenticatedStudioGuard } from "@/components/auth/authenticated-studio-guard";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AuthenticatedStudioGuard>{children}</AuthenticatedStudioGuard>;
}
