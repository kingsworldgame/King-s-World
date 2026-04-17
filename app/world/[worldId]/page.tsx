import { redirect } from "next/navigation";

export default function WorldIndexPage({ params }: { params: { worldId: string } }) {
  redirect(`/world/${params.worldId}/base`);
}