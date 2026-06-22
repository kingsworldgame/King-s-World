export const DEFAULT_WORLD_PLAYER_CAP = 25;

export function normalizeWorldPlayerCap(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_WORLD_PLAYER_CAP;
  return Math.max(1, Math.min(50, Math.floor(parsed)));
}

export function calculateCachedPowerScore(troops: {
  militia?: number | null;
  shooters?: number | null;
  scouts?: number | null;
  machinery?: number | null;
}): number {
  const unit = (value: number | null | undefined) => Math.max(0, Math.floor(Number(value ?? 0)));
  return unit(troops.militia) + unit(troops.shooters) * 2 + unit(troops.scouts) * 2 + unit(troops.machinery) * 4;
}
