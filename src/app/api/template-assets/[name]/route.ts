import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const backendApiUrl = `${configuredBackendUrl.replace(/\/api\/v1$/, "")}/api/v1`;

/** An image or clip a template starts from: passed through from the server, which keeps it permanently. */
export async function GET(request: Request, context: { params: Promise<{ name: string }> }): Promise<NextResponse> {
  try {
    const { name } = await context.params;
    const range = request.headers.get("range");
    const response = await fetch(`${backendApiUrl}/template-assets/${encodeURIComponent(name)}`, { cache: "no-store", headers: range ? { Range: range } : undefined, signal: AbortSignal.timeout(60000) });
    const body = await response.arrayBuffer();
    return new NextResponse(body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/octet-stream",
        "accept-ranges": "bytes",
        ...(response.headers.get("content-range") ? { "content-range": response.headers.get("content-range") as string } : {}),
        ...(response.ok ? { "cache-control": "public, max-age=31536000, immutable" } : {}),
      },
    });
  } catch {
    return NextResponse.json({ message: "File service is unavailable" }, { status: 503 });
  }
}
