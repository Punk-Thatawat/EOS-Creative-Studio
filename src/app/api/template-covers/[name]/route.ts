import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendApiUrl = `${configuredBackendUrl.replace(/\/api\/v1$/, "")}/api/v1`;

/** The cover image of a template made from a clip: passed through from the server, which keeps it permanently. */
export async function GET(_request: Request, context: { params: Promise<{ name: string }> }): Promise<NextResponse> {
  try {
    const { name } = await context.params;
    const response = await fetch(`${backendApiUrl}/template-covers/${encodeURIComponent(name)}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    const body = await response.arrayBuffer();
    return new NextResponse(body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/octet-stream",
        ...(response.ok ? { "cache-control": "public, max-age=31536000, immutable" } : {}),
      },
    });
  } catch {
    return NextResponse.json({ message: "Cover service is unavailable" }, { status: 503 });
  }
}
