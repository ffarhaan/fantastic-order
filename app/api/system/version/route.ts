import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const currentBuildId = process.env.NEXT_PUBLIC_APP_BUILD_ID || "dev";
  return NextResponse.json(
    {
      buildId: currentBuildId,
      timestamp: Date.now(),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "CDN-Cache-Control": "no-store",
        "Vercel-CDN-Cache-Control": "no-store",
      },
    }
  );
}
