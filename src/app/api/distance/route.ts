import { NextResponse } from "next/server";

/**
 * Legacy endpoint kept only to make old clients fail explicitly.
 * Delivery quotes now use /api/delivery/quote, which fixes the origin to the
 * restaurant and never exposes a general-purpose Google Distance Matrix proxy.
 */
export async function GET() {
  return NextResponse.json(
    {
      error:
        "Ten endpoint został zastąpiony przez bezpieczne wyliczenie kosztu dostawy.",
    },
    { status: 410 },
  );
}
