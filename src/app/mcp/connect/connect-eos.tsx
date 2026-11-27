"use client";

import { Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getApiAccessToken } from "@/lib/auth/access-token";
import { fetchBackendSession } from "@/lib/auth/backend-session";

const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "").replace(/\/api\/v1$/, "");

function readTicket(ticket: string) {
  try {
    const payload = ticket.split(".")[1];
    const data = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { typ?: unknown; exp?: unknown; callbackOrigin?: unknown };
    if (typeof data.exp !== "number" || data.exp <= Date.now() / 1000) return null;
    if (data.typ === "mcp-login") return { kind: "local" } as const;
    if (data.typ === "mcp-remote-login" && typeof data.callbackOrigin === "string") {
      const origin = new URL(data.callbackOrigin);
      const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
      if (origin.origin === data.callbackOrigin && (origin.protocol === "https:" || (loopback && origin.protocol === "http:"))) {
        return { kind: "remote", origin: origin.origin } as const;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export default function ConnectEos({ ticket }: { ticket: string }) {
  const [connection] = useState(() => readTicket(ticket));
  const [status, setStatus] = useState<"checking" | "login" | "ready" | "submitting" | "expired" | "unavailable">("checking");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const returnPath = "/mcp/connect?" + new URLSearchParams({ ticket });

  useEffect(() => {
    if (!connection) return;
    let active = true;
    async function check() {
      const token = await getApiAccessToken();
      if (!token || token === "eos-dev-bypass") {
        if (active) setStatus("login");
        return;
      }
      const profile = await fetchBackendSession(token) as { data?: { auth?: { email?: string } } };
      if (active) {
        setEmail(profile.data?.auth?.email ?? "");
        setStatus("ready");
      }
    }
    void check().catch(() => { if (active) setStatus("unavailable"); });
    return () => { active = false; };
  }, [connection]);

  async function approve() {
    setError("");
    setStatus("submitting");
    try {
      const token = await getApiAccessToken();
      if (!token || token === "eos-dev-bypass") {
        setStatus("login");
        return;
      }
      const approvePath = connection?.kind === "remote" ? "/mcp/approve" : "/api/v1/auth/mcp/approve";
      const response = await fetch(backendUrl + approvePath, {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ticket }),
        signal: AbortSignal.timeout(10000),
      });
      if (response.status === 401) {
        setStatus("login");
        return;
      }
      if (response.status === 400 || response.status === 409) {
        setStatus("expired");
        return;
      }
      if (!response.ok) throw new Error("EOS approval failed");
      const payload = await response.json() as { data?: { callbackUrl?: string } };
      const callback = payload.data?.callbackUrl ? new URL(payload.data.callbackUrl) : null;
      const validDestination = connection?.kind === "remote"
        ? callback?.origin === connection.origin
        : callback?.protocol === "http:" && callback.hostname === "127.0.0.1" && !!callback.port && callback.pathname === "/callback";
      if (!callback || !validDestination || callback.username || callback.password || !callback.searchParams.has("code")) {
        throw new Error("Invalid EOS callback");
      }
      window.location.replace(callback.href);
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ลองอีกครั้งได้เลย");
      setStatus("ready");
    }
  }

  const expired = !connection || status === "expired";
  const remote = connection?.kind === "remote";
  const title = remote ? "เชื่อมต่อ EOS MCP" : "เชื่อมต่อ EOS Local";
  const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground disabled:opacity-60";

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-12 text-foreground">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-sm" aria-live="polite">
        <div className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Link2 aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {expired ? (
          <p className="mt-3 text-sm text-muted-foreground">ลิงก์นี้หมดอายุหรือถูกใช้แล้ว ให้ขอลิงก์ใหม่จาก EOS Local ใน Codex</p>
        ) : (
          <>
            <p className="my-5 text-sm leading-6 text-muted-foreground">
              {remote ? <>อนุญาตให้ <strong className="break-all">{connection.origin}</strong> เข้าถึงบัญชี EOS และส่งงานสร้างสื่อด้วยเครดิตของคุณ</>
                : "เชื่อมบัญชี EOS กับปลั๊กอิน EOS Local บนเครื่องนี้"}
            </p>
            {email && <p className="mb-4 break-all text-sm text-muted-foreground">{email}</p>}
            {status === "login" && (
              <a className={buttonClass} href={"/?" + new URLSearchParams({ login: "1", redirect: returnPath })}>เข้าสู่ระบบ EOS</a>
            )}
            {(status === "ready" || status === "submitting") && (
              <button className={buttonClass} disabled={status === "submitting"} onClick={() => void approve()}>
                {status === "submitting" ? "กำลังเชื่อมต่อ…" : "เชื่อมต่อ"}
              </button>
            )}
            {status === "checking" && <p className="text-sm text-muted-foreground">กำลังตรวจสอบบัญชี…</p>}
            {status === "unavailable" && (
              <>
                <p className="mb-4 text-sm text-muted-foreground">ตรวจสอบบัญชีไม่ได้ กรุณาลองใหม่</p>
                <button className={buttonClass} onClick={() => window.location.reload()}>ลองอีกครั้ง</button>
              </>
            )}
            {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
          </>
        )}
      </section>
    </main>
  );
}
