import { Suspense } from "react";
import LoginPageClient from "./login-page-client";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageClient />
    </Suspense>
  );
}
