import { NextResponse } from "next/server";
export function GET() {
  return new NextResponse("Gone", {
    status: 410,
    headers: { "X-Robots-Tag": "noindex, nofollow" },
  });
}
export const dynamic = "force-dynamic";
