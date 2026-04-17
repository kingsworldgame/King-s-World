import { CampaignGuidePage } from "@/components/campaign-guide-page";
import { getWorldPayload } from "@/lib/world-data";
import { getSandboxPlaybooks } from "@/lib/sandbox-playbooks";

export default async function GuidePage({
  params,
}: {
  params: { worldId: string };
}) {
  const { world } = await getWorldPayload(params.worldId);
  const playbook = getSandboxPlaybooks().metropole;

  return <CampaignGuidePage worldId={params.worldId} playbook={playbook} defaultVillageId={world.activeVillageId} />;
}
