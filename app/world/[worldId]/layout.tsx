import type { ReactNode } from "react";

import { WorldShell } from "@/components/world-shell";
import { getWorldPayload } from "@/lib/world-data";

export default async function WorldLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { worldId: string };
}) {
  const initialPayload = await getWorldPayload(params.worldId);

  return <WorldShell worldId={params.worldId} initialPayload={initialPayload}>{children}</WorldShell>;
}
