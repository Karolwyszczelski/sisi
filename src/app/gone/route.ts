import { NextResponse } from "next/server";

export function GET() {
  const res = new NextResponse("Gone", { status: 410 });
  res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return res;
}
