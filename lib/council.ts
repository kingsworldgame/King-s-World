export type HeroSpecialistId =
  | "engineer"
  | "marshal"
  | "navigator"
  | "intendente"
  | "erudite";

export const HERO_SPECIALIST_IDS: HeroSpecialistId[] = [
  "engineer",
  "marshal",
  "navigator",
  "intendente",
  "erudite",
];

export function resolveCouncilComposition(
  councilHeroes: number,
  councilComposition?: HeroSpecialistId[],
): HeroSpecialistId[] {
  const sanitized = (councilComposition ?? []).filter((hero): hero is HeroSpecialistId =>
    HERO_SPECIALIST_IDS.includes(hero),
  );

  if (sanitized.length > 0) {
    return sanitized.slice(0, 5);
  }

  return HERO_SPECIALIST_IDS.slice(0, Math.max(0, Math.min(5, Math.floor(councilHeroes))));
}

export function countCouncilSlots(slots: HeroSpecialistId[]): Record<HeroSpecialistId, number> {
  const counts = Object.fromEntries(HERO_SPECIALIST_IDS.map((hero) => [hero, 0])) as Record<HeroSpecialistId, number>;
  for (const hero of slots) {
    counts[hero] += 1;
  }
  return counts;
}

export function formatCouncilLoadout(
  counts: Record<HeroSpecialistId, number>,
  labels: Record<HeroSpecialistId, string>,
): string {
  return HERO_SPECIALIST_IDS
    .filter((hero) => counts[hero] > 0)
    .map((hero) => `${labels[hero]} x${counts[hero]}`)
    .join(" · ");
}
