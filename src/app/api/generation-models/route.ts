import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendApiUrl = `${configuredBackendUrl.replace(/\/api\/v1$/, "")}/api/v1`;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const feature = params.get("feature")?.trim();
  if (!feature) return NextResponse.json({ message: "feature is required" }, { status: 400 });

  const query = new URLSearchParams({ feature });
  const backgroundMode = params.get("backgroundMode")?.trim();
  if (backgroundMode) query.set("backgroundMode", backgroundMode);

  const headers = new Headers({ Accept: "application/json" });
  const authorization = request.headers.get("authorization");
  if (authorization) headers.set("authorization", authorization);

  try {
    const response = await fetch(`${backendApiUrl}/generation-models?${query.toString()}`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.arrayBuffer();
    return new NextResponse(body, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json({ message: "Generation model service is unavailable" }, { status: 503 });
  }
}
