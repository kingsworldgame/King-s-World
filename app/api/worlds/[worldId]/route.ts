import { NextResponse } from "next/server";

import { getWorldPayload } from "@/lib/world-data";

export async function GET(
  _request: Request,
  { params }: { params: { worldId: string } },
) {
  try {
    const payload = await getWorldPayload(params.worldId);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load world." },
      { status: 500 },
    );
  }
}
