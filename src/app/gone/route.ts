import { NextResponse } from "next/server";

function gone() {
  return new NextResponse("Gone", {
    status: 410,
    headers: { "X-Robots-Tag": "noindex, nofollow" },
  });
}
export const GET = gone;
export const HEAD = gone;
export const POST = gone;
