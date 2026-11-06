import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell/app-shell";
import { AuthenticatedStudioGuard } from "@/components/auth/authenticated-studio-guard";
import { ReferralClaim } from "@/components/affiliate/referral-claim";

export default function StudioLayout({ children }: { children: ReactNode }) {
  return <AuthenticatedStudioGuard><ReferralClaim /><AppShell>{children}</AppShell></AuthenticatedStudioGuard>;
}
