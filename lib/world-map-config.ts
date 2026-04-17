import { GAME_BALANCE_CONSTANTS } from "@/core/GameBalance";

export const WORLD_HEX_RADIUS = 40;
export const WORLD_HEX_DIAMETER = WORLD_HEX_RADIUS * 2 + 1;
export const WORLD_HEX_TILE_COUNT = 1 + 3 * WORLD_HEX_RADIUS * (WORLD_HEX_RADIUS + 1);

export const WORLD_HEX_TILE_SIZE_PX = 18;

export const BASE_MOVE_TIME_MINUTES = GAME_BALANCE_CONSTANTS.baseMoveTimeMinutes;
export const ROAD_MOVE_TIME_MINUTES = GAME_BALANCE_CONSTANTS.roadMoveTimeMinutes;

export const CORE_RING_LIMIT = Math.floor(WORLD_HEX_RADIUS * 0.33);
export const MID_RING_LIMIT = Math.floor(WORLD_HEX_RADIUS * 0.66);
