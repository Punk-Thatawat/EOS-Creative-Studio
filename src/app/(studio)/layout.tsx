import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell/app-shell";
import { AuthenticatedStudioGuard } from "@/components/auth/authenticated-studio-guard";

export default function StudioLayout({ children }: { children: ReactNode }) {
  return <AuthenticatedStudioGuard><AppShell>{children}</AppShell></AuthenticatedStudioGuard>;
}
