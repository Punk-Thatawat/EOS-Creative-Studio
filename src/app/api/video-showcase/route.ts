import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendApiUrl = `${configuredBackendUrl.replace(/\/api\/v1$/, "")}/api/v1`;

export async function GET(): Promise<NextResponse> {
  try {
    const response = await fetch(`${backendApiUrl}/video-showcase`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    const body = await response.arrayBuffer();
    return new NextResponse(body, { status: response.status, headers: { "content-type": response.headers.get("content-type") ?? "application/json" } });
  } catch {
    return NextResponse.json({ message: "Video showcase service is unavailable" }, { status: 503 });
  }
}
