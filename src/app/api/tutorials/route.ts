import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendApiUrl = `${configuredBackendUrl.replace(/\/api\/v1$/, "")}/api/v1`;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const feature = request.nextUrl.searchParams.get("feature")?.trim();
  if (!feature) return NextResponse.json({ message: "feature is required" }, { status: 400 });

  try {
    const response = await fetch(`${backendApiUrl}/tutorials?feature=${encodeURIComponent(feature)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.arrayBuffer();
    return new NextResponse(body, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json({ message: "Tutorial service is unavailable" }, { status: 503 });
  }
}
