"use client";

export async function signInWithGoogle({
  redirectTarget,
}: { redirectTarget?: string } = {}) {
  const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "").replace(/\/api\/v1$/, "");
  const authorizationUrl = new URL(`${backendUrl}/api/v1/auth/google`);
  if (redirectTarget) authorizationUrl.searchParams.set("redirect", redirectTarget);
  window.location.assign(authorizationUrl.toString());
}
