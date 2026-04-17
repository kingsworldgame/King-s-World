import {
  calculateSovereigntyScore,
  calculateVillageDevelopment,
} from "@/core/GameBalance";
import { StrategicMap } from "@/components/board/StrategicMap";
import { getWorldPayload } from "@/lib/world-data";

export default async function BoardPage({ params }: { params: { worldId: string } }) {
  const { world } = await getWorldPayload(params.worldId);
  const villageDevelopments = world.villages.map((village) => calculateVillageDevelopment(village.buildingLevels));

  const sovereignty = calculateSovereigntyScore({
    villageDevelopments,
    councilHeroes: world.sovereignty.councilHeroes,
    militaryRankingPoints: world.sovereignty.militaryRankingPoints,
    eraQuestsCompleted: world.sovereignty.eraQuestsCompleted,
    wondersControlled: world.sovereignty.wondersControlled,
    currentDay: world.day,
    hasTribeDome: world.sovereignty.tribeDomeUnlocked,
    tribeLoyaltyStage: world.sovereignty.tribeLoyaltyStage,
    kingAlive: world.sovereignty.kingAlive,
  });

  return (
    <StrategicMap
      worldId={world.id}
      tribeName={world.tribe.name}
      sites={world.boardSites}
      villages={world.villages}
      currentDay={world.day}
      sovereigntyScore={sovereignty.total}
    />
  );
}
