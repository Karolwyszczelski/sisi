export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

const legacyRouteDisabled = () =>
  NextResponse.json(
    {
      error:
        "Ten stary endpoint został wyłączony. Strefami zarządza /api/admin/delivery-zones.",
    },
    { status: 410 },
  );

export const PATCH = legacyRouteDisabled;
export const DELETE = legacyRouteDisabled;
