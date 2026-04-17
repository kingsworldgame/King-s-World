import { OperationsClient } from "./operations-client";

export default function OperationsPage({
  params,
  searchParams,
}: {
  params: { worldId: string };
  searchParams: { v?: string; m?: string };
}) {
  return <OperationsClient params={params} searchParams={searchParams} />;
}
