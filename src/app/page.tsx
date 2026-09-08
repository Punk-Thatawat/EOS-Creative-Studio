import { PreLoginPage } from "@/features/landing/pre-login-page";
import { RedirectAuthenticated } from "./redirect-authenticated";

export const metadata = {
  title: "Create without limits",
  description: "An all-in-one AI creative studio for creators and teams.",
};

export default function HomePage() {
  return <RedirectAuthenticated><PreLoginPage /></RedirectAuthenticated>;
}
