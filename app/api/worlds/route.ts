import { NextResponse } from "next/server";

import { listWorldSummaries } from "@/lib/world-data";

export async function GET() {
  try {
    const worlds = await listWorldSummaries();
    return NextResponse.json({ worlds });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load worlds." },
      { status: 500 },
    );
  }
}
