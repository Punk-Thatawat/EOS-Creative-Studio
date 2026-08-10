import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "fal.ai webhook processing is not enabled in this phase." }, { status: 501 });
}
