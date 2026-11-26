import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "legacy_integration_retired" }, { status: 410 });
}
