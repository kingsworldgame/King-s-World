import fs from "node:fs";
import path from "node:path";

const WORLD = {
  days: 120,
  players: 50,
  humans: 8,
  bots: 42,
  seedStart: 90712026,
  seedStep: 7919,
  seedsPerProfile: 5,
};

const CHECKPOINT_DAYS = [15, 30, 60, 90, 120];
const PHASE_WINDOWS = [
  { name: "I: Consolidacao", start: 1, end: 20 },
  { name: "II: Expansao", start: 21, end: 60 },
  { name: "III: Fortificacao", start: 61, end: 90 },
  { name: "IV: Exodo", start: 91, end: 120 },
];

const OUTPUT_DIR = path.join(process.cwd(), "simulations", "output");
const SEED_MODE = process.env.SEED_MODE ?? "default";
const OUTPUT_BASENAME = SEED_MODE === "paired8" ? "season_v2_paired8" : "season_v2_120d";

const INFLUENCE_CAP = 2500;
const PORTAL_CUT = 1500;

const SCORE_WEIGHTS = Object.freeze({
  buildings: 1000,
  military: 500,
  quests: 300,
  council: 250,
  wonders: 250,
  tribe: 200,
});

const TARGETS = Object.freeze({
  secondVillageDay: 15,
  firstVillage100Day: 45,
  portalSurvivorsPerSeed: 15,
});

const BASE_MOVE_TIME_MINUTES = 45;
const ROAD_MOVE_TIME_MINUTES = 15;
const PHASE4_LOGISTICS_MULT = 5;
const ETA_SPECIALIST_MIN_HOURS = 48;
const ETA_SPECIALIST_MAX_HOURS = 60;
const WONDER_COST_MULT = 3;
const HORDE_SPIKE_DAY = 110;
const MARCH_GROUPING_OPEN_DAY = 90;

const PROFILE_DEFS = Object.freeze({
  metropole: {
    label: "Metropole",
    focusWeight: 0.44,
    buildBias: 1.12,
    expansionBias: 1.05,
    militaryBias: 0.95,
    defenseBias: 0.9,
    logisticsBias: 0.92,
    secondOffset: -1.5,
    first100Offset: -2.8,
    d90VillageOffset: 0.6,
    defaultBranch: "urban",
  },
  posto: {
    label: "Posto Avancado",
    focusWeight: 0.44,
    buildBias: 1.06,
    expansionBias: 1.08,
    militaryBias: 1.08,
    defenseBias: 0.9,
    logisticsBias: 1.08,
    secondOffset: 0.2,
    first100Offset: 0,
    d90VillageOffset: -0.2,
    defaultBranch: "tactical",
  },
  bastiao: {
    label: "Bastiao",
    focusWeight: 0.44,
    buildBias: 0.98,
    expansionBias: 0.92,
    militaryBias: 1.0,
    defenseBias: 1.03,
    logisticsBias: 0.9,
    secondOffset: 2.1,
    first100Offset: 1.5,
    d90VillageOffset: -0.4,
    defaultBranch: "defensive",
  },
  celeiro: {
    label: "Celeiro",
    focusWeight: 0.44,
    buildBias: 1.07,
    expansionBias: 1.03,
    militaryBias: 0.9,
    defenseBias: 0.95,
    logisticsBias: 1.22,
    secondOffset: 0.8,
    first100Offset: -0.7,
    d90VillageOffset: 0.2,
    defaultBranch: "flow",
  },
});

const PROFILE_KEYS = Object.keys(PROFILE_DEFS);
const BRANCH_KEYS = ["urban", "tactical", "defensive", "flow"];
const HERO_KEYS = ["engineer", "marshal", "navigator", "intendente", "erudite"];
const COUNCIL_SLOT_CAP = 5;

const HERO_DEFS = Object.freeze({
  engineer: { label: "Engenheiro", minDay: 16 },
  marshal: { label: "Marechal", minDay: 24 },
  navigator: { label: "Navegador", minDay: 56 },
  intendente: { label: "Intendente", minDay: 26 },
  erudite: { label: "Erudito", minDay: 22 },
});

const GLORY_THRESHOLDS = Object.freeze({
  metropole: 1440,
  posto: 1435,
  bastiao: 1280,
  celeiro: 1320,
});

const GLORY_PRIORITIES = Object.freeze({
  metropole: ["saveVillage", "council", "wonder", "tribe", "military"],
  posto: ["military", "council", "saveVillage", "wonder", "tribe"],
  bastiao: ["saveVillage", "tribe", "military", "council", "wonder"],
  celeiro: ["tribe", "council", "wonder", "saveVillage", "military"],
});

const HERO_GLORY_PLAN = Object.freeze({
  metropole: ["engineer", "engineer", "erudite", "intendente", "navigator"],
  posto: ["marshal", "marshal", "navigator", "engineer", "intendente"],
  bastiao: ["marshal", "marshal", "engineer", "intendente", "erudite"],
  celeiro: ["navigator", "navigator", "intendente", "engineer", "erudite"],
});

const COUNCIL_STYLE_WEIGHTS = Object.freeze({
  metropole: { engineer: 1.5, marshal: 0.65, navigator: 0.8, intendente: 1.05, erudite: 1.25 },
  posto: { engineer: 0.95, marshal: 1.55, navigator: 1.1, intendente: 0.95, erudite: 0.7 },
  bastiao: { engineer: 1.15, marshal: 1.45, navigator: 0.7, intendente: 1.0, erudite: 0.9 },
  celeiro: { engineer: 0.95, marshal: 0.7, navigator: 1.6, intendente: 1.4, erudite: 0.8 },
});

const COUNCIL_DUPLICATE_BIAS = Object.freeze({
  metropole: { engineer: 0.34, marshal: -0.12, navigator: 0.02, intendente: 0.06, erudite: 0.12 },
  posto: { engineer: 0.06, marshal: 0.36, navigator: 0.08, intendente: 0.02, erudite: -0.1 },
  bastiao: { engineer: 0.1, marshal: 0.32, navigator: -0.12, intendente: 0.05, erudite: 0.02 },
  celeiro: { engineer: 0.04, marshal: -0.14, navigator: 0.38, intendente: 0.2, erudite: -0.05 },
});

const BUILDING_AXIS = Object.freeze({
  metropole: { urban: 1.22, military: 0.92, defensive: 0.88, logistics: 0.98, research: 1.16 },
  posto: { urban: 1.02, military: 1.18, defensive: 0.9, logistics: 1.08, research: 0.98 },
  bastiao: { urban: 0.96, military: 0.98, defensive: 1.08, logistics: 0.92, research: 0.98 },
  celeiro: { urban: 1.06, military: 0.88, defensive: 0.95, logistics: 1.22, research: 1.08 },
});

const BRANCH_AXIS_TILT = Object.freeze({
  urban: { urban: 0.14, military: -0.03, defensive: -0.02, logistics: 0.03, research: 0.12 },
  tactical: { urban: -0.02, military: 0.16, defensive: -0.01, logistics: 0.05, research: 0.01 },
  defensive: { urban: 0, military: 0.02, defensive: 0.14, logistics: 0, research: 0.08 },
  flow: { urban: 0.02, military: -0.02, defensive: 0.01, logistics: 0.16, research: 0.05 },
});

const CITY_ROLE_AXIS = Object.freeze({
  metropole: { urban: 1.28, military: 0.88, defensive: 0.92, logistics: 0.96, research: 1.24 },
  posto: { urban: 0.96, military: 1.1, defensive: 1.02, logistics: 1.02, research: 0.92 },
  bastiao: { urban: 0.88, military: 1.02, defensive: 1.42, logistics: 0.92, research: 0.92 },
  celeiro: { urban: 1.08, military: 0.9, defensive: 0.98, logistics: 1.45, research: 1.08 },
});

const BRANCH_CITY_WEIGHTS = Object.freeze({
  urban: { metropole: 1.45, posto: 0.92, bastiao: 1.0, celeiro: 1.12 },
  tactical: { metropole: 1.0, posto: 1.16, bastiao: 1.12, celeiro: 1.1 },
  defensive: { metropole: 0.98, posto: 1.04, bastiao: 1.58, celeiro: 0.96 },
  flow: { metropole: 1.08, posto: 1.02, bastiao: 1.04, celeiro: 1.45 },
});

const PROFILE_CITY_WEIGHTS = Object.freeze({
  metropole: { metropole: 1.42, posto: 0.94, bastiao: 0.98, celeiro: 1.05 },
  posto: { metropole: 1.02, posto: 1.1, bastiao: 1.1, celeiro: 1.08 },
  bastiao: { metropole: 0.9, posto: 1.0, bastiao: 1.46, celeiro: 0.96 },
  celeiro: { metropole: 1.14, posto: 1.04, bastiao: 1.02, celeiro: 1.22 },
});

const QUEST_DAYS = [20, 52, 84];

const BASE_BALANCE = Object.freeze({
  branchBuffUrban: 0,
  branchBuffFlow: 0,
  portalDeathBase: 0.06,
  hordeLossBase: 3.0,
});

const round = (value, digits = 0) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const RAID_LOOT_MULT = clamp(Number(process.env.RAID_LOOT_MULT ?? 1), 0.4, 1.8);
const BATTLE_LOSS_MULT = clamp(Number(process.env.BATTLE_LOSS_MULT ?? 1), 0.6, 1.8);
const WALL_PEAK_MULT = clamp(Number(process.env.WALL_PEAK_MULT ?? 1), 0.6, 1.8);
const PVP_DEATH_MULT = clamp(Number(process.env.PVP_DEATH_MULT ?? 1), 0.4, 1.8);
const sum = (items, selector = (item) => item) => items.reduce((acc, item) => acc + selector(item), 0);
const avg = (items, selector = (item) => item) => (items.length ? sum(items, selector) / items.length : 0);
const safeDiv = (numerator, denominator) => (denominator > 0 ? numerator / denominator : 0);
function quantile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * clamp(p, 0, 1);
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

function mulberry32(seed) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randRange(rng, min, max) {
  return min + rng() * (max - min);
}

function normal(rng, mean = 0, stdDev = 1) {
  const u1 = Math.max(1e-9, rng());
  const u2 = Math.max(1e-9, rng());
  const mag = Math.sqrt(-2 * Math.log(u1));
  const z = mag * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

function pickWeighted(rng, weightedItems) {
  const total = sum(weightedItems, (item) => Math.max(0, item.weight));
  if (total <= 0) return weightedItems[0]?.key ?? null;
  let ticket = rng() * total;
  for (const item of weightedItems) {
    ticket -= Math.max(0, item.weight);
    if (ticket <= 0) return item.key;
  }
  return weightedItems[weightedItems.length - 1].key;
}

function buildSeedScenarios() {
  const seedMode = SEED_MODE;
  const scenarios = [];
  let seed = WORLD.seedStart;

  if (seedMode === "paired8") {
    for (const profileKey of PROFILE_KEYS) {
      scenarios.push({
        id: `${profileKey}-perfect`,
        seed,
        focusProfile: profileKey,
        skillPreset: "perfect",
      });
      seed += WORLD.seedStep;

      scenarios.push({
        id: `${profileKey}-lazy`,
        seed,
        focusProfile: profileKey,
        skillPreset: "faulty",
      });
      seed += WORLD.seedStep;
    }
    return scenarios;
  }

  for (const profileKey of PROFILE_KEYS) {
    for (let i = 0; i < WORLD.seedsPerProfile; i += 1) {
      scenarios.push({
        id: `${profileKey}-${i + 1}`,
        seed,
        focusProfile: profileKey,
        skillPreset: null,
      });
      seed += WORLD.seedStep;
    }
  }
  return scenarios;
}

function limitScenariosBalanced(scenarios) {
  const rawLimit = Number(process.env.SEED_LIMIT ?? 0);
  if (!Number.isFinite(rawLimit) || rawLimit <= 0 || rawLimit >= scenarios.length) {
    return scenarios;
  }

  const limit = Math.floor(rawLimit);
  const byProfile = Object.fromEntries(
    PROFILE_KEYS.map((profileKey) => [
      profileKey,
      scenarios.filter((scenario) => scenario.focusProfile === profileKey),
    ]),
  );

  const limited = [];
  while (limited.length < limit) {
    let progressed = false;
    for (const profileKey of PROFILE_KEYS) {
      const bucket = byProfile[profileKey];
      if (bucket.length > 0 && limited.length < limit) {
        limited.push(bucket.shift());
        progressed = true;
      }
    }
    if (!progressed) break;
  }

  return limited;
}

const SCENARIOS = limitScenariosBalanced(buildSeedScenarios());

function chooseProfile(rng, focusProfile, focusWeightOverride = null) {
  const focusWeight =
    typeof focusWeightOverride === "number"
      ? clamp(focusWeightOverride, 0.25, 0.9)
      : PROFILE_DEFS[focusProfile].focusWeight;
  const baseWeight = (1 - focusWeight) / (PROFILE_KEYS.length - 1);
  return pickWeighted(
    rng,
    PROFILE_KEYS.map((key) => ({
      key,
      weight: key === focusProfile ? focusWeight : baseWeight,
    })),
  );
}

function chooseBranch(rng, profileKey, skillPreset = null) {
  const defaultBranch = PROFILE_DEFS[profileKey].defaultBranch;

  if (skillPreset === "perfect") {
    if (rng() < 0.92) return defaultBranch;
  } else if (skillPreset === "faulty") {
    if (rng() < 0.38) return defaultBranch;
  } else if (rng() < 0.72) {
    return defaultBranch;
  }

  const options = BRANCH_KEYS.filter((branch) => branch !== defaultBranch);
  return options[Math.floor(rng() * options.length)];
}

function branchHeroBonus(branchKey, heroKey) {
  if (heroKey === "engineer") return branchKey === "urban" ? 0.1 : 0;
  if (heroKey === "marshal") return branchKey === "tactical" ? 0.11 : 0;
  if (heroKey === "navigator") return branchKey === "flow" ? 0.13 : 0;
  if (heroKey === "intendente") return branchKey === "flow" ? 0.08 : 0;
  if (heroKey === "erudite") return branchKey === "urban" ? 0.08 : 0;
  return 0;
}

function heroBaseChance(profile, heroKey) {
  if (heroKey === "engineer") return 0.36 + profile.buildBias * 0.08;
  if (heroKey === "marshal") return 0.22 + profile.militaryBias * 0.1;
  if (heroKey === "navigator") return 0.2 + profile.logisticsBias * 0.12;
  if (heroKey === "intendente") return 0.28 + profile.expansionBias * 0.1;
  if (heroKey === "erudite") return 0.28 + profile.buildBias * 0.07;
  return 0.2;
}

function createEmptyHeroes() {
  return Object.fromEntries(
    HERO_KEYS.map((heroKey) => [
      heroKey,
      {
        hired: false,
        day: null,
        count: 0,
        days: [],
      },
    ]),
  );
}

function addCouncilSlot(heroes, heroKey, day) {
  const nextDays = [...heroes[heroKey].days, day].sort((a, b) => a - b);
  heroes[heroKey] = {
    hired: true,
    day: nextDays[0] ?? day,
    count: nextDays.length,
    days: nextDays,
  };
}

function heroCount(heroes, heroKey) {
  return heroes[heroKey]?.count ?? 0;
}

function heroPresent(heroes, heroKey) {
  return heroCount(heroes, heroKey) > 0;
}

function desiredCouncilSlots(player, rng) {
  if (player.skillPreset === "perfect") return COUNCIL_SLOT_CAP;
  if (player.skillPreset === "faulty") {
    return clamp(Math.round(normal(rng, 2.1 + player.skillFactor * 0.45, 0.9)), 0, COUNCIL_SLOT_CAP);
  }

  return clamp(
    Math.round(
      normal(
        rng,
        2.65 +
          (player.skillFactor - 1) * 2.2 +
          (player.branchKey === PROFILE_DEFS[player.profileKey].defaultBranch ? 0.18 : -0.12),
        0.95,
      ),
    ),
    0,
    COUNCIL_SLOT_CAP,
  );
}

function councilPickWeight(player, heroKey, currentCount) {
  const profileWeight = COUNCIL_STYLE_WEIGHTS[player.profileKey]?.[heroKey] ?? 1;
  const duplicateBias = COUNCIL_DUPLICATE_BIAS[player.profileKey]?.[heroKey] ?? 0;
  const duplicatePenalty = currentCount * 0.28;
  const duplicateRelief = currentCount * duplicateBias;
  const farBoost =
    heroKey === "navigator" && player.distanceToCenterHex >= 58 ? 0.42 : 0;
  const perfectBoost =
    player.skillPreset === "perfect" && HERO_GLORY_PLAN[player.profileKey]?.includes(heroKey) ? 0.16 : 0;
  const faultyPenalty =
    player.skillPreset === "faulty" && heroKey === PROFILE_DEFS[player.profileKey].defaultBranch
      ? 0
      : player.skillPreset === "faulty"
        ? -0.08
        : 0;

  return clamp(
    heroBaseChance(player.profile, heroKey) +
      branchHeroBonus(player.branchKey, heroKey) +
      (profileWeight - 1) * 0.22 +
      duplicateRelief -
      duplicatePenalty +
      farBoost +
      perfectBoost +
      faultyPenalty +
      player.skillFactor * 0.05,
    0.04,
    0.98,
  );
}

function targetPerfectHeroDay(heroKey, player, rng, copyIndex = 0) {
  if (heroKey === "engineer") return clamp(Math.round(normal(rng, 32 + copyIndex * 5, 4)), HERO_DEFS.engineer.minDay, 54);
  if (heroKey === "erudite") return clamp(Math.round(normal(rng, 28 + copyIndex * 4, 4)), HERO_DEFS.erudite.minDay, 46);
  if (heroKey === "intendente") return clamp(Math.round(normal(rng, 40 + copyIndex * 4, 5)), HERO_DEFS.intendente.minDay, 58);
  if (heroKey === "marshal") return clamp(Math.round(normal(rng, 45 + copyIndex * 4, 5)), HERO_DEFS.marshal.minDay, 60);
  if (heroKey === "navigator") {
    const mean = player.distanceToCenterHex >= 52 || player.branchKey === "flow" ? 56 : 60;
    return clamp(Math.round(normal(rng, mean + copyIndex * 4, 4)), HERO_DEFS.navigator.minDay, 72);
  }
  return HERO_DEFS[heroKey].minDay;
}

function slotHireDayForHero(player, heroKey, rng, copyIndex = 0) {
  if (player.skillPreset === "perfect") {
    return targetPerfectHeroDay(heroKey, player, rng, copyIndex);
  }

  if (heroKey === "navigator" && player.distanceToCenterHex >= 56) {
    const mean = player.skillPreset === "faulty" ? 86 + copyIndex * 6 : 58 + copyIndex * 5;
    return clamp(Math.round(normal(rng, mean, player.skillPreset === "faulty" ? 7 : 5)), HERO_DEFS.navigator.minDay, 112);
  }

  const baseMean =
    HERO_DEFS[heroKey].minDay +
    18 +
    copyIndex * 5 +
    (player.skillPreset === "faulty" ? 12 : 0) -
    (player.skillPreset === "perfect" ? 6 : 0) -
    (player.skillFactor - 1) * 12;

  return clamp(Math.round(normal(rng, baseMean, 7)), HERO_DEFS[heroKey].minDay, 110);
}

function resolveBuildingAxes(profileKey, branchKey) {
  const profileAxis = BUILDING_AXIS[profileKey] ?? BUILDING_AXIS.metropole;
  const branchTilt = BRANCH_AXIS_TILT[branchKey] ?? BRANCH_AXIS_TILT.urban;
  return {
    urban: profileAxis.urban + branchTilt.urban,
    military: profileAxis.military + branchTilt.military,
    defensive: profileAxis.defensive + branchTilt.defensive,
    logistics: profileAxis.logistics + branchTilt.logistics,
    research: profileAxis.research + branchTilt.research,
  };
}

function createEmptyCityMix() {
  return Object.fromEntries(PROFILE_KEYS.map((profileKey) => [profileKey, 0]));
}

function addCityToMix(cityMix, cityType) {
  cityMix[cityType] = (cityMix[cityType] ?? 0) + 1;
}

function resolveCityPlan(profileKey, branchKey, rng, skillPreset = null) {
  const cityPlan = [profileKey];
  const guaranteed = [];

  if (skillPreset !== "faulty") guaranteed.push("celeiro", "bastiao", "posto");
  if (skillPreset === "perfect") guaranteed.push("metropole");

  for (const cityType of guaranteed) {
    if (cityPlan.length >= 10) break;
    cityPlan.push(cityType);
  }

  while (cityPlan.length < 10) {
    const pick = pickWeighted(
      rng,
      PROFILE_KEYS.map((cityType) => {
        const branchWeight = BRANCH_CITY_WEIGHTS[branchKey]?.[cityType] ?? 1;
        const profileWeight = PROFILE_CITY_WEIGHTS[profileKey]?.[cityType] ?? 1;
        const currentCount = cityPlan.filter((entry) => entry === cityType).length;
        const diversityBoost = currentCount === 0 ? 0.16 : 0;
        const duplicatePenalty = currentCount * 0.14;
        const perfectBias = skillPreset === "perfect" && cityType === branchKeyToCity(branchKey) ? 0.1 : 0;
        const faultyPenalty = skillPreset === "faulty" && cityType !== profileKey ? -0.04 : 0;
        return {
          key: cityType,
          weight: clamp(branchWeight * 0.58 + profileWeight * 0.42 + diversityBoost + perfectBias + faultyPenalty - duplicatePenalty, 0.12, 2.2),
        };
      }),
    );
    cityPlan.push(pick);
  }

  return cityPlan.slice(0, 10);
}

function resolveCityMix(cityPlan, villages) {
  const totalCities = clamp(Math.round(villages), 1, 10);
  const cityMix = createEmptyCityMix();
  for (const cityType of (cityPlan ?? []).slice(0, totalCities)) {
    addCityToMix(cityMix, cityType);
  }
  return cityMix;
}

function branchKeyToCity(branchKey) {
  if (branchKey === "urban") return "metropole";
  if (branchKey === "tactical") return "posto";
  if (branchKey === "defensive") return "bastiao";
  return "celeiro";
}

function citySupportFromMix(cityMix) {
  const totalCities = Math.max(1, sum(PROFILE_KEYS, (key) => cityMix[key] ?? 0));
  const diversity = PROFILE_KEYS.filter((key) => (cityMix[key] ?? 0) > 0).length;
  const support = { urban: 0, military: 0, defensive: 0, logistics: 0, research: 0 };

  for (const cityType of PROFILE_KEYS) {
    const count = cityMix[cityType] ?? 0;
    const weight = count / totalCities;
    const axis = CITY_ROLE_AXIS[cityType] ?? CITY_ROLE_AXIS.metropole;
    support.urban += axis.urban * weight;
    support.military += axis.military * weight;
    support.defensive += axis.defensive * weight;
    support.logistics += axis.logistics * weight;
    support.research += axis.research * weight;
  }

  return {
    ...support,
    diversity,
    totalCities,
  };
}

function citySupportAtDay(player, day) {
  if (day <= 90) {
    return player.citySupportD90 ?? citySupportFromMix(player.cityMixD90 ?? createEmptyCityMix());
  }
  return player.citySupportD120 ?? citySupportFromMix(player.cityMixD120 ?? createEmptyCityMix());
}

function simulateHeroes(player, rng) {
  const heroes = createEmptyHeroes();
  const councilSlots = [];
  const desiredSlots = desiredCouncilSlots(player, rng);

  for (let slotIndex = 0; slotIndex < desiredSlots; slotIndex += 1) {
    const plannedHero =
      player.skillPreset === "perfect"
        ? HERO_GLORY_PLAN[player.profileKey]?.[slotIndex] ?? null
        : null;

    const heroKey =
      plannedHero ??
      pickWeighted(
        rng,
        HERO_KEYS.map((key) => ({
          key,
          weight: councilPickWeight(player, key, heroCount(heroes, key)),
        })),
      );

    const copyIndex = heroCount(heroes, heroKey);
    const day = slotHireDayForHero(player, heroKey, rng, copyIndex);
    addCouncilSlot(heroes, heroKey, day);
    councilSlots.push({ heroKey, day, slot: slotIndex + 1 });
  }

  return { heroes, councilSlots };
}

function recountCouncil(player) {
  player.councilCount = sum(HERO_KEYS, (hero) => heroCount(player.heroes, hero));
  player.councilPoints = clamp(player.councilCount, 0, 5) * 50;
}

function selectNextHeroForGlory(player) {
  const plan = HERO_GLORY_PLAN[player.profileKey] ?? HERO_KEYS;
  return plan.find((hero) => heroCount(player.heroes, hero) < plan.filter((entry) => entry === hero).length) ?? null;
}

function forceHireHero(player, heroKey, day) {
  addCouncilSlot(player.heroes, heroKey, day);
  player.councilSlots = [...(player.councilSlots ?? []), { heroKey, day, slot: (player.councilSlots?.length ?? 0) + 1 }]
    .sort((a, b) => a.day - b.day)
    .slice(0, COUNCIL_SLOT_CAP);
  recountCouncil(player);
}

function canEnterGloryMode(player) {
  if (player.skillPreset === "perfect") return true;
  if (player.skillPreset === "faulty") return false;
  const threshold = GLORY_THRESHOLDS[player.profileKey] ?? 1180;
  const questCount = player.quests.filter(Boolean).length;
  return (
    player.influenceD90 >= threshold ||
    (player.influenceD90 >= threshold - 45 &&
      player.skillFactor >= 1.12 &&
      questCount >= 2 &&
      player.firstVillage100Day <= 52)
  );
}

function computeGloryBudget(player) {
  if (player.skillPreset === "perfect") return 12;

  let budget = 0;
  if (player.influenceD90 >= (GLORY_THRESHOLDS[player.profileKey] ?? 1180)) budget += 1;
  if (player.firstVillage100Day <= 50) budget += 1;
  if (player.quests.filter(Boolean).length >= 2) budget += 1;
  if (player.explorationBonus >= 8) budget += 1;
  if (player.skillFactor >= 1.12) budget += 1;
  if (heroPresent(player.heroes, "engineer") && heroPresent(player.heroes, "intendente")) budget += 1;
  return clamp(budget, 0, 4);
}

function applyGloryAction(player, action, rng) {
  if (action === "saveVillage") {
    if (player.villagesD120 >= 10) return false;
    if (player.skillPreset === "perfect" || player.villageLosses > 0 || player.villagesD120 < player.villagesD90) {
      player.villagesD120 += 1;
      player.villageLosses = Math.max(0, player.villageLosses - 1);
      return true;
    }
    return false;
  }

  if (action === "council") {
    const nextHero = selectNextHeroForGlory(player);
    if (!nextHero) return false;
    const copyIndex = heroCount(player.heroes, nextHero);
    const targetDay = player.skillPreset === "perfect"
      ? targetPerfectHeroDay(nextHero, player, rng, copyIndex)
      : clamp(Math.round(normal(rng, HERO_DEFS[nextHero].minDay + 18 + copyIndex * 5, 6)), HERO_DEFS[nextHero].minDay, 78);
    forceHireHero(player, nextHero, targetDay);
    return true;
  }

  if (action === "wonder") {
    if (!heroPresent(player.heroes, "engineer") || player.wondersD120 >= 5) return false;
    player.wondersD120 += 1;
    if (player.wondersD90 < 3) {
      player.wondersD90 += 1;
    }
    return true;
  }

  if (action === "tribe") {
    if (player.forceTribeDome || player.councilCount < 2 || player.villagesD120 < 3) return false;
    player.forceTribeDome = true;
    return true;
  }

  if (action === "military") {
    const powerBoost =
      150 +
      (heroCount(player.heroes, "marshal") * 45) +
      (player.branchKey === "tactical" ? 40 : 0) +
      (player.profile.militaryBias > 1 ? 30 : 0);
    player.militaryPowerD120 += powerBoost;
    if (heroPresent(player.heroes, "marshal") && (player.heroes.marshal.day ?? 999) <= 90) {
      player.militaryPowerD90 += Math.round(powerBoost * 0.35);
    }
    return true;
  }

  return false;
}

function applyGloryPlan(player, rng) {
  if (!canEnterGloryMode(player)) {
    return;
  }

  if (player.skillPreset === "perfect") {
    const plan = HERO_GLORY_PLAN[player.profileKey] ?? HERO_KEYS;
    for (const [slotIndex, heroKey] of plan.entries()) {
      if ((player.councilSlots ?? []).length >= COUNCIL_SLOT_CAP) break;
      const targetDay = targetPerfectHeroDay(heroKey, player, rng, slotIndex);
      forceHireHero(player, heroKey, targetDay);
    }
    player.wondersD90 = Math.max(player.wondersD90, 3);
    player.wondersD120 = 5;
    player.villagesD90 = Math.max(player.villagesD90, 9);
    player.villagesD120 = 10;
    player.villageLosses = Math.max(0, player.villagesD90 - player.villagesD120);
    player.forceTribeDome = true;
    player.militaryPowerD120 += 520;
    player.militaryPowerD90 += 180;
    recountCouncil(player);
    return;
  }

  let budget = computeGloryBudget(player);
  const priorities = GLORY_PRIORITIES[player.profileKey] ?? [];
  while (budget > 0) {
    let progressed = false;
    for (const action of priorities) {
      if (applyGloryAction(player, action, rng)) {
        budget -= 1;
        progressed = true;
        if (budget <= 0) break;
      }
    }
    if (!progressed) {
      break;
    }
  }

  recountCouncil(player);
}

function resolveTribeDome(player, rng) {
  if (player.forceTribeDome) return true;
  if (player.councilCount < 2 || player.villagesD120 < 3) return false;

  const questCount = player.quests.filter(Boolean).length;
  const chance = clamp(
    0.32 +
      questCount * 0.11 +
      Math.min(0.14, heroCount(player.heroes, "intendente") * 0.06) +
      (player.branchKey === "flow" ? 0.05 : 0) +
      (player.branchKey === "defensive" ? 0.04 : 0) +
      (player.influenceD90 >= 1350 ? 0.08 : 0) -
      (player.firstVillage100Day > 55 ? 0.06 : 0),
    0.18,
    0.92,
  );
  return rng() < chance;
}

function questChance(player, questIndex) {
  const buildingAxes = player.buildingAxes ?? resolveBuildingAxes(player.profileKey, player.branchKey);
  const base = 0.4;
  const erudite = Math.min(0.18, heroCount(player.heroes, "erudite") * 0.09);
  const branch =
    (player.branchKey === "urban" ? 0.05 : 0) +
    (player.branchKey === "tactical" && questIndex > 0 ? 0.06 : 0) +
    (player.branchKey === "defensive" && questIndex === 2 ? 0.06 : 0) +
    (player.branchKey === "flow" && questIndex === 2 ? 0.05 : 0);
  const researchLift = Math.max(0, buildingAxes.research - 1) * 0.08;
  const exploration = (player.explorationBonus ?? 0) * 0.02;
  const presetBoost =
    player.skillPreset === "perfect" ? 0.08 : player.skillPreset === "faulty" ? -0.09 : 0;
  const pressure = questIndex === 2 ? 0.08 : 0;
  return clamp(
    base + erudite + branch + researchLift + exploration + presetBoost + player.skillFactor * 0.04 - pressure,
    0.1,
    0.86,
  );
}

function simulateQuests(player, rng) {
  const success = [false, false, false];
  for (let i = 0; i < 3; i += 1) {
    let chance = questChance(player, i);
    if (i === 2 && player.firstVillage100Day > 62) chance -= 0.12;
    if (heroPresent(player.heroes, "erudite") && (player.heroes.erudite.day ?? 999) <= QUEST_DAYS[i]) chance += 0.05 + Math.max(0, heroCount(player.heroes, "erudite") - 1) * 0.02;
    chance = clamp(chance, 0.1, 0.82);
    success[i] = rng() <= chance;
  }
  return success;
}

function estimateVillageCount(day, player) {
  if (day < player.secondVillageDay) return 1;
  if (day <= 90) {
    const progress = safeDiv(day - player.secondVillageDay, Math.max(1, 90 - player.secondVillageDay));
    return clamp(Math.round(2 + progress * (player.villagesD90 - 2)), 2, player.villagesD90);
  }
  const progress = safeDiv(day - 90, 30);
  return clamp(Math.round(player.villagesD90 + progress * (player.villagesD120 - player.villagesD90)), 1, 10);
}

function estimateBuildingInfluence(day, player) {
  const villages = estimateVillageCount(day, player);
  const profile = player.profile;
  const first100 = player.firstVillage100Day;
  const buildingAxes = player.buildingAxes ?? resolveBuildingAxes(player.profileKey, player.branchKey);
  const citySupport = citySupportAtDay(player, day);

  // Breakthrough Logic (Sovereign 2.1)
  // We model the average building level in a village on a given day.
  // Linear growth from 30 to 100, but we apply the spiky multipliers to the "power" value.
  const rawLevel = clamp(
    3.0 +
    day * 0.072 +
    (45 - first100) * 0.09 +
    (profile.buildBias - 1) * 3.0 +
    (buildingAxes.urban - 1) * 2.1 +
    (buildingAxes.research - 1) * 1.4 +
    (buildingAxes.logistics - 1) * 1.1 +
    (citySupport.urban - 1) * 1.35 +
    (citySupport.research - 1) * 1.1 +
    Math.min(1.2, heroCount(player.heroes, "engineer") * 0.55) +
    (player.explorationBonus ?? 0) * 0.08,
    2,
    10,
  );

  let multipliers = 0;
  for (let i = 2; i <= Math.floor(rawLevel); i++) {
    if (i === 10) multipliers += 2.6;
    else if (i === 7) multipliers += 1.8;
    else if (i === 3) multipliers += 1.5;
    else multipliers += 1.0;
  }
  // Add fractional part for smooth transition
  const fraction = rawLevel - Math.floor(rawLevel);
  if (rawLevel < 10) {
    const nextI = Math.floor(rawLevel) + 1;
    let nextMult = 1.0;
    if (nextI === 10) nextMult = 2.6;
    else if (nextI === 7) nextMult = 1.8;
    else if (nextI === 3) nextMult = 1.5;
    multipliers += fraction * nextMult;
  }

  // Map to scale 100 per village
  const developmentConversion =
    day <= 90
      ? clamp(
        0.8 +
          (citySupport.urban - 1) * 0.16 +
          (citySupport.research - 1) * 0.14 +
          Math.min(0.05, citySupport.diversity * 0.01) -
          (player.branchKey === "tactical" ? 0.035 : 0) -
          (player.branchKey === "defensive" ? 0.025 : 0),
        0.78,
        0.98,
      )
      : clamp(
        0.96 +
          (citySupport.urban - 1) * 0.08 +
          (citySupport.research - 1) * 0.08 +
          Math.min(0.04, citySupport.diversity * 0.008),
        0.92,
        1.04,
      );

  const growth = clamp(multipliers * 10 * developmentConversion, 20, 100);

  return clamp(Math.round(villages * growth), 0, SCORE_WEIGHTS.buildings);
}

function computeEtaHours(player, rng) {
  const distance = player.distanceToCenterHex ?? Math.round(randRange(rng, 36, 74));
  const buildingAxes = player.buildingAxes ?? resolveBuildingAxes(player.profileKey, player.branchKey);
  const citySupport = player.citySupportD120 ?? citySupportFromMix(player.cityMixD120 ?? createEmptyCityMix());
  const navigatorCount = heroCount(player.heroes, "navigator");
  const intendenteCount = heroCount(player.heroes, "intendente");
  const hasNavigator = navigatorCount > 0;
  const hasIntendente = intendenteCount > 0;
  const flowBranch = player.branchKey === "flow";

  const roadCoverage = clamp(
    0.18 +
    (flowBranch ? 0.24 : 0) +
    Math.min(0.22, navigatorCount * 0.1) +
    Math.min(0.16, intendenteCount * 0.08) +
    Math.max(0, buildingAxes.logistics - 1) * 0.14 +
    Math.max(0, citySupport.logistics - 1) * 0.16 +
    (player.profile.logisticsBias - 1) * 0.24,
    0.1,
    0.9,
  );

  const baseMinutesPerHex = BASE_MOVE_TIME_MINUTES * (1 - roadCoverage) + ROAD_MOVE_TIME_MINUTES * roadCoverage;
  let eta = (distance * baseMinutesPerHex * PHASE4_LOGISTICS_MULT) / 60;

  if (hasNavigator && flowBranch) {
    const specialistEta =
      54 -
      intendenteCount * 2.1 -
      Math.max(0, navigatorCount - 1) * 1.8 +
      (player.profile.logisticsBias - 1) * 3.5 +
      normal(rng, 0, 3.4);
    return round(clamp(specialistEta, ETA_SPECIALIST_MIN_HOURS, ETA_SPECIALIST_MAX_HOURS), 2);
  }

  if (hasNavigator) eta *= Math.max(0.56, 0.8 - navigatorCount * 0.08);
  if (flowBranch) eta *= 0.81;
  if (hasIntendente) eta *= Math.max(0.78, 0.94 - intendenteCount * 0.05);
  if (!hasNavigator && distance >= 58) eta *= 1.18;

  eta = clamp(eta + normal(rng, 0, 6), 72, 220);
  return round(eta, 2);
}

function simulatePlayer(index, scenario, rng, balance) {
  const isHuman = index < WORLD.humans;
  const scenarioPreset = scenario.skillPreset ?? null;
  const isPrimaryScenarioPlayer = index === 0 && scenarioPreset !== null;

  let profileKey = isPrimaryScenarioPlayer
    ? scenario.focusProfile
    : chooseProfile(rng, scenario.focusProfile, scenario.skillPreset ? 0.62 : null);
  const profile = PROFILE_DEFS[profileKey];

  let playerPreset = null;
  if (isPrimaryScenarioPlayer) {
    playerPreset = scenarioPreset;
  } else if (!isHuman && scenarioPreset === "faulty" && rng() < 0.28) {
    playerPreset = "faulty";
  } else if (!isHuman && scenarioPreset === "perfect" && rng() < 0.18) {
    playerPreset = "perfect";
  }

  let branchKey = chooseBranch(rng, profileKey, playerPreset);
  if (
    isPrimaryScenarioPlayer &&
    scenarioPreset === "faulty" &&
    branchKey === PROFILE_DEFS[profileKey].defaultBranch
  ) {
    const wrongBranches = BRANCH_KEYS.filter(
      (branch) => branch !== PROFILE_DEFS[profileKey].defaultBranch,
    );
    branchKey = wrongBranches[Math.floor(rng() * wrongBranches.length)];
  }

  const skillFactor =
    playerPreset === "perfect"
      ? clamp(normal(rng, 1.23, 0.05), 1.06, 1.38)
      : playerPreset === "faulty"
        ? clamp(normal(rng, 0.84, 0.08), 0.62, 1.02)
        : clamp(normal(rng, 1, 0.14), 0.68, 1.36);

  const buildingAxes = resolveBuildingAxes(profileKey, branchKey);
  const cityPlan = resolveCityPlan(profileKey, branchKey, rng, playerPreset);

  const aggression = clamp(
    normal(rng, profile.militaryBias + (branchKey === "tactical" ? 0.05 : 0), 0.14),
    0.65,
    1.45,
  );
  const defense = clamp(
    normal(rng, profile.defenseBias + (branchKey === "defensive" ? 0.04 : 0), 0.12),
    0.62,
    1.5,
  );

  const explorationSorties = clamp(
    Math.round(
      normal(
        rng,
        3.4 +
        aggression * 2 +
        (branchKey === "tactical" ? 1.2 : 0) +
        (branchKey === "flow" ? 0.8 : 0) +
        (playerPreset === "perfect" ? 1.3 : 0) +
        (playerPreset === "faulty" ? -1.3 : 0),
        1.7,
      ),
    ),
    0,
    12,
  );

  const raidHitChance = clamp(
    0.32 +
    aggression * 0.24 +
    (branchKey === "tactical" ? 0.15 : 0) +
    (branchKey === "flow" ? 0.08 : 0) +
    (skillFactor - 1) * 0.28,
    0.15,
    0.92,
  );

  const raidLootScore = Math.round(explorationSorties * raidHitChance * randRange(rng, 55, 105) * RAID_LOOT_MULT);
  const explorationBonus = clamp(Math.round(raidLootScore / 170), 0, 14);

  const secondVillageDay = clamp(
    Math.round(
      normal(
        rng,
        15 +
        profile.secondOffset +
        (branchKey === "flow" ? -0.8 : 0.5) -
        (buildingAxes.urban - 1) * 2.2 -
        (buildingAxes.logistics - 1) * 2.8 -
        explorationBonus * 0.11 +
        (playerPreset === "perfect" ? -1.2 : 0) +
        (playerPreset === "faulty" ? 1.6 : 0),
        3.9,
      ),
    ),
    8,
    34,
  );

  const firstVillage100Day = clamp(
    Math.round(
      normal(
        rng,
        47.2 +
        profile.first100Offset +
        (secondVillageDay - 15) * 0.28 -
        (buildingAxes.urban - 1) * 7.2 -
        (buildingAxes.research - 1) * 5.4 -
        (buildingAxes.logistics - 1) * 2.8 -
        explorationBonus * 0.24 +
        (playerPreset === "perfect" ? -2.4 : 0) +
        (playerPreset === "faulty" ? 3.2 : 0),
        6.2,
      ),
    ),
    28,
    94,
  );

  const distanceToCenterHex = Math.round(randRange(rng, 36, 74));
  const heroSimulation = simulateHeroes(
    { profile, profileKey, branchKey, skillFactor, firstVillage100Day, isHuman, distanceToCenterHex, skillPreset: playerPreset },
    rng,
  );
  const heroes = heroSimulation.heroes;
  let councilSlots = heroSimulation.councilSlots;

  if (isPrimaryScenarioPlayer && playerPreset === "perfect") {
    councilSlots = [];
    for (const [slotIndex, heroKey] of (HERO_GLORY_PLAN[profileKey] ?? HERO_KEYS).entries()) {
      const day = targetPerfectHeroDay(heroKey, { branchKey, distanceToCenterHex }, rng, slotIndex);
      councilSlots.push({ heroKey, day, slot: slotIndex + 1 });
    }
    const rebuiltHeroes = createEmptyHeroes();
    for (const slot of councilSlots) {
      addCouncilSlot(rebuiltHeroes, slot.heroKey, slot.day);
    }
    for (const heroKey of HERO_KEYS) {
      heroes[heroKey] = rebuiltHeroes[heroKey];
    }
  }

  if (isPrimaryScenarioPlayer && playerPreset === "faulty") {
    if (heroPresent(heroes, "navigator") && distanceToCenterHex >= 58) {
      const delayedDays = heroes.navigator.days.map((day) => clamp(Math.round(normal(rng, day + 20, 6)), 78, 112));
      heroes.navigator = {
        hired: delayedDays.length > 0,
        day: delayedDays[0] ?? null,
        count: delayedDays.length,
        days: delayedDays,
      };
      councilSlots = councilSlots.map((slot) =>
        slot.heroKey === "navigator"
          ? { ...slot, day: clamp(Math.round(normal(rng, slot.day + 20, 6)), 78, 112) }
          : slot,
      );
    }

    if (heroPresent(heroes, "engineer") && rng() < 0.55) {
      const trimmed = Math.max(0, heroCount(heroes, "engineer") - 1);
      const nextDays = heroes.engineer.days.slice(0, trimmed);
      heroes.engineer = {
        hired: nextDays.length > 0,
        day: nextDays[0] ?? null,
        count: nextDays.length,
        days: nextDays,
      };
      councilSlots = councilSlots.filter((slot, index) => !(slot.heroKey === "engineer" && index === councilSlots.findIndex((entry) => entry.heroKey === "engineer")));
    }
  }

  const councilCount = sum(HERO_KEYS, (hero) => heroCount(heroes, hero));
  const councilPoints = clamp(councilCount, 0, 5) * 50;
  const branchSupport =
    branchKey === "urban"
      ? heroCount(heroes, "engineer") + heroCount(heroes, "erudite")
      : branchKey === "tactical"
        ? heroCount(heroes, "marshal") + heroCount(heroes, "navigator")
        : branchKey === "defensive"
          ? heroCount(heroes, "engineer") + heroCount(heroes, "marshal")
          : heroCount(heroes, "navigator") + heroCount(heroes, "intendente");

  let quests = simulateQuests(
    {
      profile,
      branchKey,
      heroes,
      skillFactor,
      firstVillage100Day,
      explorationBonus,
      skillPreset: playerPreset,
    },
    rng,
  );

  if (isPrimaryScenarioPlayer && playerPreset === "perfect" && rng() < 0.9) {
    quests = [true, true, true];
  }

  if (isPrimaryScenarioPlayer && playerPreset === "faulty") {
    quests = [quests[0] && rng() < 0.6, false, false];
  }

  const questCountD90 = quests.filter(Boolean).length;
  const questPointsD90 = questCountD90 * 100;

  const hasEngineer = heroPresent(heroes, "engineer");
  const hasIntendente = heroPresent(heroes, "intendente");

  const wonderEconomyScore = clamp(
    skillFactor * 0.72 +
    (profile.buildBias - 1) * 1.8 +
    (buildingAxes.urban - 1) * 1.3 +
    (buildingAxes.research - 1) * 0.95 +
    (buildingAxes.logistics - 1) * 0.55 +
    explorationBonus * 0.16 +
    (branchKey === "urban" ? 0.28 : 0) +
    (hasIntendente ? 0.3 : -0.2) +
    (firstVillage100Day <= 45 ? 0.5 : firstVillage100Day <= 55 ? 0.2 : -0.28) +
    (playerPreset === "perfect" ? 1.0 : 0) +
    (playerPreset === "faulty" ? -0.35 : 0),
    -1.8,
    2.8,
  );

  const wonderBudgetPressure = WONDER_COST_MULT * 0.58;
  const wonderPotentialBase =
    (hasEngineer ? 1.0 : -3.0) +
    wonderEconomyScore -
    wonderBudgetPressure +
    (branchKey === "urban" ? 0.24 + balance.branchBuffUrban * 1.1 : 0);

  let wonderPotential = clamp(Math.round(normal(rng, wonderPotentialBase, 1.0)), 0, 5);

  const collapseChance = hasEngineer
    ? clamp(0.34 - wonderEconomyScore * 0.1, 0.03, 0.48)
    : 0.95;

  if (rng() < collapseChance) {
    wonderPotential = Math.max(0, wonderPotential - (hasEngineer ? 1 : 3));
  }

  const canFullWonderChain =
    hasEngineer &&
    wonderEconomyScore >= 0.75 &&
    (hasIntendente || explorationBonus >= 7 || branchKey === "urban") &&
    firstVillage100Day <= 56;

  const maxWondersD120 = canFullWonderChain ? 5 : 4;
  let wondersD90 = clamp(Math.min(wonderPotential, Math.round((90 - firstVillage100Day) / 20) + 1), 0, 3);
  let wondersD120 = clamp(
    Math.max(wondersD90, wonderPotential + (canFullWonderChain && rng() < 0.32 ? 1 : 0)),
    0,
    maxWondersD120,
  );

  if (isPrimaryScenarioPlayer && playerPreset === "perfect") {
    if (hasEngineer) {
      wondersD90 = Math.max(wondersD90, 3);
      wondersD120 = Math.max(wondersD120, 4 + (rng() < 0.45 ? 1 : 0));
    } else {
      wondersD90 = 0;
      wondersD120 = 0;
    }
  }

  if (isPrimaryScenarioPlayer && playerPreset === "faulty") {
    wondersD90 = Math.min(wondersD90, 1);
    wondersD120 = Math.min(wondersD120, 1);
  }

  let villagesD90 = clamp(
    Math.round(
      normal(
        rng,
        7.2 +
          profile.d90VillageOffset +
          (15 - secondVillageDay) * 0.06 +
          heroCount(heroes, "intendente") * 0.46 +
          (buildingAxes.logistics - 1) * 1.7 +
          (buildingAxes.urban - 1) * 1.1,
        1.0,
      ),
    ),
    5,
    10,
  );

  const cityMixD90 = resolveCityMix(cityPlan, villagesD90);
  const citySupportD90 = citySupportFromMix(cityMixD90);

  const wallStrength = clamp(
    0.16 +
    profile.defenseBias * 0.2 +
    (buildingAxes.defensive - 1) * 0.18 +
    (citySupportD90.defensive - 1) * 0.24 +
    (branchKey === "defensive" ? 0.1 : 0) +
    Math.min(0.24, heroCount(heroes, "marshal") * 0.1) +
    Math.min(0.14, heroCount(heroes, "engineer") * 0.07) +
    Math.min(0.08, (cityMixD90.bastiao ?? 0) * 0.03) +
    (firstVillage100Day <= 48 ? 0.1 : 0) +
    (quests[1] ? 0.06 : 0) +
    (quests[2] ? 0.1 : 0) +
    normal(rng, 0, 0.06),
    0.05,
    1.35,
  );

  const executionPenalty = clamp(
    (secondVillageDay > 18 ? 0.2 : 0) +
    (firstVillage100Day > 55 ? 0.28 : 0) +
    (villagesD90 >= 8 && !heroPresent(heroes, "intendente") ? 0.16 : 0) +
    (councilCount <= 1 ? 0.14 : 0) +
    (branchKey !== profile.defaultBranch ? 0.1 : 0) +
    (branchKey === "flow" && !heroPresent(heroes, "navigator") ? 0.08 : 0) +
    Math.max(0, buildingAxes.military - 1) * -0.1 +
    Math.max(0, 1.02 - citySupportD90.logistics) * 0.14 -
    Math.max(0, citySupportD90.defensive - 1) * 0.08 -
    Math.max(0, buildingAxes.defensive - ((buildingAxes.urban + buildingAxes.logistics) / 2)) * 0.22 +
    normal(rng, 0, 0.06),
    0,
    0.8,
  );

  const wallPeakCharge = clamp(
    (
      Math.max(0, wallStrength - 0.9) * 1.45 +
      (branchKey === "defensive" ? 0.14 : 0) +
      Math.min(0.14, heroCount(heroes, "engineer") * 0.06) +
      Math.min(0.1, heroCount(heroes, "marshal") * 0.04) +
      (quests[2] ? 0.08 : 0) +
      (firstVillage100Day <= 50 ? 0.06 : 0) -
      executionPenalty * 0.2
    ) * WALL_PEAK_MULT,
    0,
    0.95,
  );
  const wallPeakReady = wallPeakCharge >= 0.32;

  const expectedHordeLossesBase =
    balance.hordeLossBase +
    (profileKey === "bastiao" ? 0.25 : 1.0) +
    (branchKey === "defensive" ? -0.08 : 0.35) +
    (branchKey === "flow" ? -0.35 : 0) +
    (branchKey === "urban" ? -0.05 : 0) +
    (branchKey === "tactical" ? 0.12 : 0) +
    Math.min(0.24, heroCount(heroes, "intendente") * -0.08) +
    (branchSupport === 0 ? 0.42 : branchSupport === 1 ? 0.14 : -0.1) +
    executionPenalty * 3.45 -
    wallStrength * 1.58 -
    Math.max(0, citySupportD90.logistics - 1) * 0.42 -
    wallPeakCharge * 1.2 -
    Math.max(0, buildingAxes.logistics - 1) * 0.36 -
    Math.max(0, buildingAxes.military - 1) * 0.5;

  const expectedHordeLosses = expectedHordeLossesBase * BATTLE_LOSS_MULT;

  let villageLosses = Math.round(clamp(normal(rng, expectedHordeLosses, 0.95), 0, 6));

  const noLossChance =
    wallStrength >= 1.08 && executionPenalty <= 0.22 && (quests[2] || branchKey === "defensive")
      ? 1
      : clamp(
        0.015 +
      Math.max(0, wallStrength - 0.95) * 0.25 +
      wallPeakCharge * 0.34 +
      Math.max(0, citySupportD90.defensive - 1) * 0.16 +
      (quests[2] ? 0.04 : 0) -
      (branchSupport >= 2 ? 0.05 : 0) -
      Math.max(0, buildingAxes.defensive - 1) * 0.06 -
      executionPenalty * 0.8,
        0.01,
        0.72,
      );

  if (rng() < noLossChance) {
    villageLosses = 0;
  } else if (wallPeakReady && executionPenalty <= 0.28 && villageLosses > 0 && rng() < 0.55) {
    villageLosses = Math.max(0, villageLosses - 1);
  } else if (executionPenalty >= 0.58) {
    villageLosses = Math.max(2, villageLosses);
  } else if (executionPenalty >= 0.45) {
    villageLosses = Math.max(1, villageLosses);
  }

  const captured = clamp(Math.round(normal(rng, aggression > 1.12 ? 1.1 : 0.35, 0.6)), 0, 2);
  let villagesD120 = clamp(villagesD90 - villageLosses + captured, 1, 10);
  if (isPrimaryScenarioPlayer && playerPreset === "perfect") {
    villagesD90 = Math.max(villagesD90, 9);
    villagesD120 = Math.max(villagesD120, 9);
    villageLosses = 0;
  }

  if (isPrimaryScenarioPlayer && playerPreset === "faulty") {
    villagesD90 = Math.min(villagesD90, 6);
    villagesD120 = Math.max(1, Math.min(villagesD120, Math.floor(villagesD90 * 0.6)));
    villageLosses = Math.max(villageLosses, Math.max(0, villagesD90 - villagesD120));
  }

  const cityMixD120 = resolveCityMix(cityPlan, villagesD120);
  const citySupportD120 = citySupportFromMix(cityMixD120);

  const troopCap = Math.round(randRange(rng, 1500, 2500));
  const troopFillD90 = clamp(
    0.62 +
    profile.militaryBias * 0.14 +
    (branchKey === "tactical" ? 0.08 : 0) +
    (buildingAxes.military - 1) * 0.12 +
    (citySupportD90.military - 1) * 0.12 +
    Math.min(0.11, heroCount(heroes, "marshal") * 0.05) +
    normal(rng, 0, 0.06),
    0.48,
    0.95,
  );
  const troopsD90 = clamp(Math.round(troopCap * troopFillD90), 900, troopCap);

  const troopLossRatio = clamp(
    normal(
      rng,
      0.46 +
      (profileKey === "bastiao" ? -0.08 : 0.05) +
      (branchKey === "defensive" ? -0.04 : 0.03) +
      Math.max(0, buildingAxes.military - 1) * -0.1 +
      Math.max(0, citySupportD120.defensive - 1) * -0.12 +
      Math.max(0, citySupportD120.logistics - 1) * -0.11 +
      Math.max(0, 1 - buildingAxes.defensive) * 0.06 -
      (BATTLE_LOSS_MULT - 1) * 0.16 -
      Math.min(0.08, heroCount(heroes, "marshal") * -0.03),
      0.1,
    ),
    0.18,
    0.72,
  );
  const troopsD120 = Math.max(280, Math.round(troopsD90 * (1 - troopLossRatio)));

  const qualityFactor = clamp(
    0.84 +
    profile.militaryBias * 0.14 +
    (branchKey === "tactical" ? 0.16 : 0) +
    (buildingAxes.military - 1) * 0.18 +
    (citySupportD120.military - 1) * 0.18 +
    Math.min(0.16, heroCount(heroes, "marshal") * 0.08) +
    normal(rng, 0, 0.04),
    0.78,
    1.35,
  );

  return {
    id: `${isHuman ? "H" : "B"}${String(index + 1).padStart(2, "0")}`,
    isPrimaryScenarioPlayer,
    profileKey,
    profile,
    branchKey,
    buildingAxes,
    cityPlan,
    skillFactor,
    aggression,
    defense,
    skillPreset: playerPreset,
    explorationSorties,
    raidLootScore,
    explorationBonus,
    secondVillageDay,
    firstVillage100Day,
    distanceToCenterHex,
    heroes,
    councilSlots,
    branchSupport,
    councilCount,
    councilPoints,
    quests,
    questPointsD90,
    questPoints120: questPointsD90,
    wondersD90,
    wondersD120,
    villagesD90,
    villageLosses,
    villagesD120,
    cityMixD90,
    cityMixD120,
    citySupportD90,
    citySupportD120,
    villagesLostToPvp: 0,
    troopCap,
    troopsD90,
    troopsD120,
    militaryPowerD90: troopsD90 * qualityFactor,
    militaryPowerD120: troopsD120 * qualityFactor * (0.96 + normal(rng, 0, 0.04)),
    etaHours: 0,
    groupingDay: MARCH_GROUPING_OPEN_DAY,
    marchStartDay: null,
    enteredPortal: false,
    diedOnTrail: false,
    alive: true,
    portalBlocked: false,
    portalBlockReason: null,
    influenceD90: 0,
    influenceD120: 0,
    maxInfluenceObserved: 0,
    wallStrength,
    wallPeakCharge,
    wallPeakReady,
    pvpEliminated: false,
    checkpoints: {},
    actionTimeline: [],
  };
}

function assignMilitaryRanking(players, dayKey) {
  const key = dayKey === "d120" ? "militaryPowerD120" : "militaryPowerD90";
  const sorted = [...players].sort((a, b) => b[key] - a[key]);
  const maxIndex = Math.max(1, sorted.length - 1);

  sorted.forEach((player, idx) => {
    const percentile = 1 - idx / maxIndex;
    const base = (0.14 + percentile * 0.86) * SCORE_WEIGHTS.military;
    const profileBonus = player.profile.militaryBias * 22;
    const tacticalBonus = player.branchKey === "tactical" ? 20 : 0;
    const flowBonus = player.branchKey === "flow" ? 32 : 0;
    const urbanBonus = player.branchKey === "urban" ? 4 : 0;
    const defensivePenalty = player.branchKey === "defensive" ? -8 : 0;
    const marshalBonus = heroCount(player.heroes, "marshal") * 18;
    const points = clamp(
      Math.round(base + profileBonus + tacticalBonus + flowBonus + urbanBonus + defensivePenalty + marshalBonus),
      18,
      SCORE_WEIGHTS.military,
    );
    if (dayKey === "d120") {
      player.militaryPointsD120 =
        player.isPrimaryScenarioPlayer && player.skillPreset === "perfect"
          ? SCORE_WEIGHTS.military
          : points;
    } else {
      player.militaryPointsD90 =
        player.isPrimaryScenarioPlayer && player.skillPreset === "perfect"
          ? Math.max(points, player.profileKey === "celeiro" ? 360 : 420)
          : points;
    }
  });
}

function councilPointsAtDay(player, day) {
  const points = (player.councilSlots ?? []).filter((slot) => slot.day <= day).length * 50;
  return clamp(points, 0, SCORE_WEIGHTS.council);
}

function questPointsAtDay(player, day) {
  let points = 0;
  for (let i = 0; i < 3; i += 1) {
    if (player.quests[i] && day >= QUEST_DAYS[i]) points += 100;
  }
  return clamp(points, 0, SCORE_WEIGHTS.quests);
}

function wonderPointsAtDay(player, day) {
  if (day < 40 || !heroPresent(player.heroes, "engineer")) return 0;
  const count = day <= 90 ? player.wondersD90 : player.wondersD120;
  return clamp(count, 0, 5) * 50;
}

function villageCountAtDay(player, day) {
  return estimateVillageCount(day, player);
}

function troopsAtDay(player, day) {
  if (day <= 90) {
    const start = Math.round(player.troopCap * 0.08);
    const progress = day / 90;
    return Math.round(start + progress * (player.troopsD90 - start));
  }
  const progress = (day - 90) / 30;
  return Math.round(player.troopsD90 + progress * (player.troopsD120 - player.troopsD90));
}

function militaryPointsAtDay(player, day) {
  const target = day <= 90 ? player.militaryPointsD90 : player.militaryPointsD120;
  const factor = day <= 90 ? day / 90 : 0.9 + ((day - 90) / 30) * 0.1;
  return clamp(Math.round(target * factor), 0, SCORE_WEIGHTS.military);
}

function influenceAtDay(player, day) {
  const building = estimateBuildingInfluence(day, player);
  const military = militaryPointsAtDay(player, day);
  const council = councilPointsAtDay(player, day);
  const quests = questPointsAtDay(player, day);
  const wonders = wonderPointsAtDay(player, day);
  const tribe = day >= 91 && player.tribeDome ? SCORE_WEIGHTS.tribe : 0;
  return {
    building,
    military,
    council,
    quests,
    wonders,
    tribe,
    total: clamp(building + military + council + quests + wonders + tribe, 0, INFLUENCE_CAP),
  };
}

function simulateLatePvpPressure(player, rng) {
  const militaryGuard = safeDiv(player.militaryPointsD90, SCORE_WEIGHTS.military);
  const wallGuard = (player.wallStrength ?? 0) + (player.wallPeakCharge ?? 0);
  const citySupportD90 = player.citySupportD90 ?? citySupportFromMix(player.cityMixD90 ?? createEmptyCityMix());
  const wideEmpirePressure = Math.max(0, player.villagesD90 - 7) * 0.02;
  const exposedBranchPenalty =
    player.branchKey === "urban" ? 0.015 : player.branchKey === "flow" ? 0.02 : 0;
  const councilRelief = player.councilCount >= 4 ? 0.02 : 0;
  const strongWallGate =
    player.wallPeakReady &&
    player.wallStrength >= 1.02 &&
    player.skillFactor >= 0.94 &&
    (player.cityMixD90?.bastiao ?? 0) >= 2;

  const pvpCityLossMean = clamp(
    (
      0.18 +
      wideEmpirePressure * 9 +
      Math.max(0, 1.02 - wallGuard) * 1.35 +
      Math.max(0, 0.86 - militaryGuard) * 1.2 +
      Math.max(0, player.villageLosses - 1) * 0.12 +
      exposedBranchPenalty -
      Math.max(0, citySupportD90.logistics - 1) * 0.22 -
      Math.max(0, citySupportD90.defensive - 1) * 0.38 -
      Math.max(0, citySupportD90.military - 1) * 0.22 -
      Math.max(0, (player.buildingAxes?.military ?? 1) - 1) * 0.24 -
      Math.max(0, (player.buildingAxes?.defensive ?? 1) - 1) * 0.26 -
      (player.wallPeakReady ? 0.28 : 0) -
      (strongWallGate ? 0.36 : 0) -
      (player.branchSupport >= 2 ? 0.08 : 0) -
      councilRelief
    ) * PVP_DEATH_MULT,
    0,
    2.4,
  );

  let villagesLostToPvp = Math.round(clamp(normal(rng, pvpCityLossMean, 0.55), 0, 2));
  if (strongWallGate && villagesLostToPvp > 0 && rng() < 0.72) {
    villagesLostToPvp = Math.max(0, villagesLostToPvp - 1);
  } else if (player.wallPeakReady && player.skillFactor >= 0.98 && villagesLostToPvp > 0 && rng() < 0.6) {
    villagesLostToPvp -= 1;
  }

  const pvpKillRisk = clamp(
    (
      0.08 +
      wideEmpirePressure +
      Math.max(0, 0.95 - wallGuard) * 0.16 +
      Math.max(0, 0.84 - militaryGuard) * 0.18 +
      (player.influenceD90 >= PORTAL_CUT ? 0.015 : 0) +
      exposedBranchPenalty -
      Math.max(0, citySupportD90.logistics - 1) * 0.1 -
      Math.max(0, citySupportD90.defensive - 1) * 0.09 -
      Math.max(0, citySupportD90.military - 1) * 0.06 -
      Math.max(0, (player.buildingAxes?.military ?? 1) - 1) * 0.08 -
      Math.max(0, (player.buildingAxes?.defensive ?? 1) - 1) * 0.07 -
      (player.wallPeakReady ? 0.05 : 0) -
      (strongWallGate ? 0.05 : 0) -
      (player.branchSupport >= 2 ? 0.025 : 0) -
      councilRelief -
      (player.skillPreset === "perfect" ? 0.04 : 0)
    ) * PVP_DEATH_MULT,
    0.01,
    0.24,
  );

  if (villagesLostToPvp > 0) {
    player.villagesD120 = clamp(player.villagesD120 - villagesLostToPvp, 1, 10);
    player.cityMixD120 = resolveCityMix(player.cityPlan, player.villagesD120);
    player.citySupportD120 = citySupportFromMix(player.cityMixD120);
  }
  player.villagesLostToPvp = villagesLostToPvp;

  if (rng() < pvpKillRisk) {
    player.pvpEliminated = true;
    player.alive = false;
    player.portalBlocked = true;
    player.portalBlockReason = "pvp_eliminated";
  }
}

function simulatePortalOutcome(player, rng, balance) {
  if (player.pvpEliminated) {
    return;
  }

  player.etaHours = computeEtaHours(player, rng);

  const hasNavigator = heroPresent(player.heroes, "navigator");
  const flowBranch = player.branchKey === "flow";
  const defensive = player.branchKey === "defensive";
  const branchEscortSynergy =
    player.branchKey === "urban"
      ? heroPresent(player.heroes, "engineer") && heroPresent(player.heroes, "erudite")
      : player.branchKey === "tactical"
        ? heroPresent(player.heroes, "marshal") && heroPresent(player.heroes, "navigator")
        : player.branchKey === "defensive"
          ? heroPresent(player.heroes, "engineer") && heroPresent(player.heroes, "marshal")
          : heroPresent(player.heroes, "navigator") && heroPresent(player.heroes, "intendente");

  const regroupOpenDay = MARCH_GROUPING_OPEN_DAY;
  player.groupingDay = regroupOpenDay;

  const safeLatestStart = 118 - Math.ceil(player.etaHours / 24);
  const decisionError =
    player.skillPreset === "perfect"
      ? normal(rng, -1.1, 1.2)
      : player.skillPreset === "faulty"
        ? normal(rng, 3.6, 2)
        : normal(rng, (1 - player.skillFactor) * 5 + 1.2, 2);

  const readinessDelay = clamp(
    8 +
    safeDiv(1500 - player.influenceD90, 125) +
    (player.quests.filter(Boolean).length >= 2 ? -1.2 : 1.4),
    4,
    20,
  );

  let proposedStart =
    regroupOpenDay +
    readinessDelay +
    decisionError -
    (hasNavigator ? 1 : 0) -
    (flowBranch ? 1 : 0);

  proposedStart = Math.max(proposedStart, safeLatestStart + decisionError * 0.15);
  player.marchStartDay = clamp(Math.round(proposedStart), regroupOpenDay, 119);

  player.influenceD120 = influenceAtDay(player, 120).total;

  player.maxInfluenceObserved = Math.max(player.influenceD90, player.influenceD120);

  const availableHours = (120 - player.marchStartDay) * 24;
  const navigatorGateFail = player.distanceToCenterHex >= 64 && !hasNavigator;
  const canReach = player.etaHours <= availableHours && !navigatorGateFail;

  if (!canReach) {
    player.diedOnTrail = true;
    player.alive = false;
    player.portalBlocked = true;
    player.portalBlockReason = "eta_late";
    return;
  }

  const branchInterceptRisk = clamp(
    balance.portalDeathBase +
      (player.branchSupport === 0 ? 0.09 : player.branchSupport === 1 ? 0.04 : 0) +
      (player.branchKey === "flow" && !heroPresent(player.heroes, "navigator") ? 0.04 : 0) +
      (player.branchKey === "urban" && !heroPresent(player.heroes, "erudite") ? 0.02 : 0) +
      (player.branchKey === "tactical" && !heroPresent(player.heroes, "marshal") ? 0.025 : 0) -
      (player.branchSupport >= 2 ? 0.03 : 0) -
      (branchEscortSynergy ? 0.035 : 0) -
      (player.councilCount >= 5 ? 0.015 : 0) -
      Math.max(0, (player.buildingAxes?.logistics ?? 1) - 1) * 0.08 -
      Math.max(0, (player.buildingAxes?.military ?? 1) - 1) * 0.05 -
      (defensive ? 0.01 : 0) -
      (player.skillPreset === "perfect" ? 0.02 : 0),
    0.01,
    0.26,
  );

  const effectiveInterceptRisk =
    player.skillPreset === "perfect" &&
    player.influenceD120 >= INFLUENCE_CAP &&
    player.councilCount >= COUNCIL_SLOT_CAP &&
    player.wondersD120 >= 5 &&
    player.tribeDome
      ? Math.max(0.01, branchInterceptRisk - 0.08)
      : branchInterceptRisk;

  if (rng() < effectiveInterceptRisk) {
    player.diedOnTrail = true;
    player.alive = false;
    player.portalBlocked = true;
    player.portalBlockReason = "intercepted";
    return;
  }

  if (player.influenceD120 < PORTAL_CUT) {
    player.portalBlocked = true;
    player.portalBlockReason = "influencia_insuficiente";
    player.alive = false;
    return;
  }


  player.enteredPortal = true;
  player.alive = true;
}

function simulateRun(scenario, balance) {
  const rng = mulberry32(scenario.seed);
  const players = Array.from({ length: WORLD.players }, (_, index) => simulatePlayer(index, scenario, rng, balance));

  assignMilitaryRanking(players, "d90");
  assignMilitaryRanking(players, "d120");

  for (const player of players) {
    player.influenceD90 = influenceAtDay(player, 90).total;
  }

  for (const player of players) {
    applyGloryPlan(player, rng);
  }

  assignMilitaryRanking(players, "d90");
  assignMilitaryRanking(players, "d120");

  for (const player of players) {
    player.tribeDome = resolveTribeDome(player, rng);
    player.influenceD90 = influenceAtDay(player, 90).total;
    simulateLatePvpPressure(player, rng);
    player.influenceD120 = influenceAtDay(player, 120).total;
    player.maxInfluenceObserved = Math.max(player.influenceD90, player.influenceD120);

    for (const day of CHECKPOINT_DAYS) {
      const inf = influenceAtDay(player, day);
      player.checkpoints[day] = {
        influenceTotal: inf.total,
        buildings: inf.building,
        military: inf.military,
        council: inf.council,
        quests: inf.quests,
        wonders: inf.wonders,
        tribe: inf.tribe,
        villages: villageCountAtDay(player, day),
        troops: troopsAtDay(player, day),
      };
    }
  }

  for (const player of players) {
    simulatePortalOutcome(player, rng, balance);
  }

  for (const player of players) {
    player.actionTimeline = buildActionTimeline(player);
  }

  const records = players.map((player) => ({
    id: player.id,
    profile: player.profileKey,
    branch: player.branchKey,
    secondVillageDay: player.secondVillageDay,
    firstVillage100Day: player.firstVillage100Day,
    skillPreset: player.skillPreset,
    isPrimaryScenarioPlayer: player.isPrimaryScenarioPlayer,
    distanceToCenterHex: player.distanceToCenterHex,
    cityPlan: player.cityPlan,
    cityMixD90: player.cityMixD90,
    cityMixD120: player.cityMixD120,
    explorationSorties: player.explorationSorties,
    raidLootScore: player.raidLootScore,
    explorationBonus: player.explorationBonus,
    villagesD90: player.villagesD90,
    villagesD120: player.villagesD120,
    villagesLostToHorde: player.villageLosses,
    villagesLostToPvp: player.villagesLostToPvp,
    totalVillagesLost: player.villageLosses + player.villagesLostToPvp,
    heroes: (player.councilSlots ?? []).map((slot) => slot.heroKey),
    councilSlots: player.councilSlots ?? [],
    heroCounts: Object.fromEntries(HERO_KEYS.map((hero) => [hero, heroCount(player.heroes, hero)])),
    heroStates: Object.fromEntries(
      HERO_KEYS.map((hero) => [
        hero,
        {
          hired: heroPresent(player.heroes, hero),
          count: heroCount(player.heroes, hero),
          day: player.heroes[hero].day,
          days: player.heroes[hero].days,
        },
      ]),
    ),
    heroHireDay: Object.fromEntries(HERO_KEYS.map((hero) => [hero, player.heroes[hero].day])),
    questCount: player.quests.filter(Boolean).length,
    questStates: [...player.quests],
    wondersD90: player.wondersD90,
    wondersD120: player.wondersD120,
    troopCap: player.troopCap,
    troopsD90: player.troopsD90,
    troopsAlive: player.troopsD120,
    militaryPointsD90: player.militaryPointsD90,
    militaryPointsD120: player.militaryPointsD120,
    influenceD90: player.influenceD90,
    influenceD120: player.influenceD120,
    maxInfluenceObserved: player.maxInfluenceObserved,
    tribeDome: player.tribeDome,
    wallStrength: player.wallStrength,
    wallPeakCharge: player.wallPeakCharge,
    wallPeakReady: player.wallPeakReady,
    etaHours: player.etaHours,
    groupingDay: player.groupingDay,
    marchStartDay: player.marchStartDay,
    enteredPortal: player.enteredPortal,
    diedOnTrail: player.diedOnTrail,
    alive: player.alive,
    pvpEliminated: player.pvpEliminated,
    portalBlocked: player.portalBlocked,
    portalBlockReason: player.portalBlockReason,
    checkpoints: player.checkpoints,
    actionTimeline: player.actionTimeline,
  }));


  const checkpoints = {};
  for (const day of CHECKPOINT_DAYS) {
    const points = records.map((record) => record.checkpoints[day]);
    checkpoints[day] = {
      day,
      playersAlive: day >= 120 ? records.filter((record) => record.alive).length : records.length,
      playersEligiblePortal: records.filter((record) => (record.checkpoints[day]?.influenceTotal ?? 0) >= PORTAL_CUT).length,
      avgInfluence: round(avg(points, (point) => point.influenceTotal), 2),
      avgBuildingInfluence: round(avg(points, (point) => point.buildings), 2),
      avgMilitaryInfluence: round(avg(points, (point) => point.military), 2),
      avgCouncilInfluence: round(avg(points, (point) => point.council), 2),
      avgQuestInfluence: round(avg(points, (point) => point.quests), 2),
      avgWonderInfluence: round(avg(points, (point) => point.wonders), 2),
      avgTribeInfluence: round(avg(points, (point) => point.tribe), 2),
      avgTroops: round(avg(points, (point) => point.troops), 2),
      avgVillages: round(avg(points, (point) => point.villages), 2),
    };
  }

  return {
    scenarioId: scenario.id,
    seed: scenario.seed,
    focusProfile: scenario.focusProfile,
    records,
    checkpoints,
    portalSurvivors: records.filter((record) => record.enteredPortal).length,
    finalAlive: records.filter((record) => record.alive).length,
    day90Eligible: records.filter((record) => record.influenceD90 >= PORTAL_CUT).length,
    reached2500: records.filter((record) => record.maxInfluenceObserved >= INFLUENCE_CAP).length,
    avgSecondVillageDay: round(avg(records, (record) => record.secondVillageDay), 2),
    avgFirstVillage100Day: round(avg(records, (record) => record.firstVillage100Day), 2),
  };
}

function flattenRecords(runs) {
  return runs.flatMap((run) =>
    run.records.map((record) => ({
      ...record,
      seed: run.seed,
      scenarioId: run.scenarioId,
      focusProfile: run.focusProfile,
    })),
  );
}

function computeLock(runs) {
  const records = flattenRecords(runs);
  return {
    avgSecondVillageDay: avg(records, (record) => record.secondVillageDay),
    avgFirstVillage100Day: avg(records, (record) => record.firstVillage100Day),
    avgPortalSurvivors: avg(runs, (run) => run.portalSurvivors),
    avgDay90Eligible: avg(runs, (run) => run.day90Eligible),
    avgReached2500: avg(runs, (run) => run.reached2500),
    styleCap2500Rate: Object.fromEntries(
      PROFILE_KEYS.map((profileKey) => {
        const group = records.filter((record) => record.profile === profileKey);
        return [
          profileKey,
          safeDiv(group.filter((record) => record.maxInfluenceObserved >= INFLUENCE_CAP).length, Math.max(1, group.length)),
        ];
      }),
    ),
  };
}

function runCalibrated() {
  const balance = { ...BASE_BALANCE };
  let runs = [];
  let lock = null;
  let iteration = 0;

  for (let pass = 1; pass <= 6; pass += 1) {
    runs = SCENARIOS.map((scenario) => simulateRun(scenario, balance));
    lock = computeLock(runs);
    iteration = pass;

    let adjusted = false;
    if (lock.styleCap2500Rate.metropole < 0.04 && balance.branchBuffUrban < 0.12) {
      balance.branchBuffUrban = 0.12;
      adjusted = true;
    }
    if (lock.styleCap2500Rate.celeiro < 0.04 && balance.branchBuffFlow < 0.12) {
      balance.branchBuffFlow = 0.12;
      adjusted = true;
    }

    const portalDiff = lock.avgPortalSurvivors - TARGETS.portalSurvivorsPerSeed;
    if (portalDiff > 1.2 && balance.portalDeathBase < 0.18) {
      balance.portalDeathBase = round(balance.portalDeathBase + 0.02, 2);
      adjusted = true;
    } else if (portalDiff < -1.2 && balance.portalDeathBase > 0.02) {
      balance.portalDeathBase = round(balance.portalDeathBase - 0.02, 2);
      adjusted = true;
    }

    if (!adjusted) {
      break;
    }
  }

  return { iteration, balance, runs, lock };
}

function summarizeByProfile(records) {
  return PROFILE_KEYS.map((profileKey) => {
    const group = records.filter((record) => record.profile === profileKey);
    return {
      profile: profileKey,
      label: PROFILE_DEFS[profileKey].label,
      players: group.length,
      portalRatePct: round(safeDiv(group.filter((r) => r.enteredPortal).length, Math.max(1, group.length)) * 100, 2),
      avgInfluenceD90: round(avg(group, (record) => record.influenceD90), 2),
      avgInfluenceD120: round(avg(group, (record) => record.influenceD120), 2),
      avgTroopsD120: round(avg(group, (record) => record.troopsAlive), 2),
      avgVillagesLostToHorde: round(avg(group, (record) => record.villagesLostToHorde), 2),
      avgSecondVillageDay: round(avg(group, (record) => record.secondVillageDay), 2),
      avgFirstVillage100Day: round(avg(group, (record) => record.firstVillage100Day), 2),
      reached2500RatePct: round(safeDiv(group.filter((r) => r.maxInfluenceObserved >= INFLUENCE_CAP).length, Math.max(1, group.length)) * 100, 2),
    };
  });
}

function summarizeByBranch(records) {
  return BRANCH_KEYS.map((branch) => {
    const group = records.filter((record) => record.branch === branch);
    return {
      branch,
      players: group.length,
      portalRatePct: round(safeDiv(group.filter((r) => r.enteredPortal).length, Math.max(1, group.length)) * 100, 2),
      day90EligibleRatePct: round(safeDiv(group.filter((r) => r.influenceD90 >= PORTAL_CUT).length, Math.max(1, group.length)) * 100, 2),
      reached2500RatePct: round(safeDiv(group.filter((r) => r.maxInfluenceObserved >= INFLUENCE_CAP).length, Math.max(1, group.length)) * 100, 2),
      avgInfluenceD90: round(avg(group, (record) => record.influenceD90), 2),
      avgInfluenceD120: round(avg(group, (record) => record.influenceD120), 2),
      avgEtaHours: round(avg(group, (record) => record.etaHours), 2),
      trailDeathRatePct: round(safeDiv(group.filter((record) => record.diedOnTrail).length, Math.max(1, group.length)) * 100, 2),
      avgVillagesLostToHorde: round(avg(group, (record) => record.villagesLostToHorde), 2),
    };
  });
}

function summarizeHeroes(records) {
  return HERO_KEYS.map((heroKey) => {
    const users = records.filter((record) => record.heroes.includes(heroKey));
    const nonUsers = records.filter((record) => !record.heroes.includes(heroKey));
    const portalUsers = safeDiv(users.filter((r) => r.enteredPortal).length, Math.max(1, users.length));
    const portalNon = safeDiv(nonUsers.filter((r) => r.enteredPortal).length, Math.max(1, nonUsers.length));

    return {
      hero: heroKey,
      label: HERO_DEFS[heroKey].label,
      users: users.length,
      adoptionRatePct: round(safeDiv(users.length, Math.max(1, records.length)) * 100, 2),
      avgCopiesUsers: round(avg(users, (record) => record.heroCounts?.[heroKey] ?? 0), 2),
      avgHireDay: round(avg(users.map((record) => record.heroHireDay[heroKey]).filter(Boolean)), 2),
      portalRateUsersPct: round(portalUsers * 100, 2),
      portalRateNonUsersPct: round(portalNon * 100, 2),
      portalDeltaPp: round((portalUsers - portalNon) * 100, 2),
      avgEtaUsers: round(avg(users, (record) => record.etaHours), 2),
      avgInfluenceD120Users: round(avg(users, (record) => record.influenceD120), 2),
    };
  });
}

function summarizeCalibrationFocus(records, lock, branchSummary) {
  const navFlow = records.filter(
    (record) => record.branch === "flow" && record.heroes.includes("navigator"),
  );
  const etaValues = navFlow.map((record) => record.etaHours);
  const etaAvg = round(avg(etaValues), 2);
  const etaP90 = round(quantile(etaValues, 0.9), 2);
  const etaInTargetPct = round(
    safeDiv(
      navFlow.filter(
        (record) =>
          record.etaHours >= ETA_SPECIALIST_MIN_HOURS &&
          record.etaHours <= ETA_SPECIALIST_MAX_HOURS,
      ).length,
      Math.max(1, navFlow.length),
    ) * 100,
    2,
  );

  const flowBranchRow = branchSummary.find((row) => row.branch === "flow");

  return {
    etaNavigatorFlowAvg: etaAvg,
    etaNavigatorFlowP90: etaP90,
    etaNavigatorFlowInTargetPct: etaInTargetPct,
    etaFlowBranchAvg: flowBranchRow?.avgEtaHours ?? 0,
    reached2500PerSeed: round(lock.avgReached2500, 2),
  };
}

function summarizeRunTable(runs) {
  return runs.map((run) => {
    const records = run.records;
    return {
      seed: run.seed,
      scenario: run.scenarioId,
      focusProfile: run.focusProfile,
      portalSurvivors: run.portalSurvivors,
      finalAlive: run.finalAlive,
      day90Eligible: run.day90Eligible,
      reached2500: run.reached2500,
      hordeDeaths: records.filter((record) => record.villagesLostToHorde > 0).length,
      pvpDeaths: records.filter((record) => record.pvpEliminated).length,
      trailDeaths: records.filter((record) => record.diedOnTrail).length,
      avgVillagesLostToHorde: round(avg(records, (record) => record.villagesLostToHorde), 2),
      avgVillagesLostTotal: round(avg(records, (record) => record.totalVillagesLost), 2),
      avgTroops: round(avg(records, (record) => record.troopsAlive), 2),
      avgHeroes: round(avg(records, (record) => record.heroes.length), 2),
      avgEta: round(avg(records, (record) => record.etaHours), 2),
      dominantBranch:
        BRANCH_KEYS.map((branch) => ({ branch, count: records.filter((record) => record.branch === branch).length }))
          .sort((a, b) => b.count - a.count)[0]?.branch ?? "n/a",
      avgSecondVillageDay: run.avgSecondVillageDay,
      avgFirstVillage100Day: run.avgFirstVillage100Day,
    };
  });
}

function summarizeCheckpoints(runs) {
  const rows = [];
  for (const day of CHECKPOINT_DAYS) {
    const points = runs.map((run) => run.checkpoints[day]).filter(Boolean);
    rows.push({
      day,
      avgPlayersAlive: round(avg(points, (point) => point.playersAlive), 2),
      avgEligiblePortal: round(avg(points, (point) => point.playersEligiblePortal), 2),
      avgInfluence: round(avg(points, (point) => point.avgInfluence), 2),
      avgBuildingInfluence: round(avg(points, (point) => point.avgBuildingInfluence), 2),
      avgMilitaryInfluence: round(avg(points, (point) => point.avgMilitaryInfluence), 2),
      avgCouncilInfluence: round(avg(points, (point) => point.avgCouncilInfluence), 2),
      avgQuestInfluence: round(avg(points, (point) => point.avgQuestInfluence), 2),
      avgWonderInfluence: round(avg(points, (point) => point.avgWonderInfluence), 2),
      avgTribeInfluence: round(avg(points, (point) => point.avgTribeInfluence), 2),
      avgTroops: round(avg(points, (point) => point.avgTroops), 2),
      avgVillages: round(avg(points, (point) => point.avgVillages), 2),
    });
  }
  return rows;
}

function summarizePhaseWindows(checkpointsSummary) {
  return PHASE_WINDOWS.map((window) => {
    const inWindow = checkpointsSummary.filter((row) => row.day >= window.start && row.day <= window.end);
    return {
      phase: window.name,
      start: window.start,
      end: window.end,
      avgInfluence: round(avg(inWindow, (row) => row.avgInfluence), 2),
      avgEligiblePortal: round(avg(inWindow, (row) => row.avgEligiblePortal), 2),
      avgTroops: round(avg(inWindow, (row) => row.avgTroops), 2),
      avgVillages: round(avg(inWindow, (row) => row.avgVillages), 2),
    };
  });
}

function phaseLabelForDay(day) {
  if (day <= 20) return "I";
  if (day <= 60) return "II";
  if (day <= 90) return "III";
  return "IV";
}

function actionPriority(type) {
  switch (type) {
    case "upgrade":
      return 1;
    case "recruit":
      return 2;
    case "explore":
      return 3;
    case "hero":
      return 4;
    case "expand":
      return 5;
    case "quest":
      return 6;
    case "wonder":
      return 7;
    case "tribe":
      return 8;
    case "horde":
      return 9;
    case "group":
      return 10;
    case "march":
      return 11;
    case "outcome":
      return 12;
    default:
      return 99;
  }
}

function pushTimelineAction(timeline, day, type, action, detail) {
  timeline.push({
    day: Math.max(1, Math.min(120, Math.round(day))),
    phase: phaseLabelForDay(day),
    type,
    action,
    detail,
  });
}

function openingPlanForProfile(profileKey) {
  if (profileKey === "metropole") {
    return [
      { day: 1, building: "Minas", target: 2 },
      { day: 1, building: "Fazendas", target: 2 },
      { day: 2, building: "Palacio", target: 2 },
      { day: 2, building: "Senado", target: 2 },
      { day: 3, building: "Minas", target: 3 },
      { day: 3, building: "Fazendas", target: 3 },
      { day: 4, building: "Palacio", target: 3 },
      { day: 4, building: "Senado", target: 3 },
    ];
  }

  if (profileKey === "posto") {
    return [
      { day: 1, building: "Minas", target: 2 },
      { day: 1, building: "Fazendas", target: 2 },
      { day: 2, building: "Quartel", target: 2 },
      { day: 2, building: "Arsenal", target: 2 },
      { day: 3, building: "Minas", target: 3 },
      { day: 3, building: "Fazendas", target: 3 },
      { day: 4, building: "Quartel", target: 3 },
      { day: 4, building: "Arsenal", target: 3 },
    ];
  }

  if (profileKey === "bastiao") {
    return [
      { day: 1, building: "Minas", target: 2 },
      { day: 1, building: "Fazendas", target: 2 },
      { day: 2, building: "Habitacoes", target: 2 },
      { day: 2, building: "Muralha", target: 2 },
      { day: 3, building: "Minas", target: 3 },
      { day: 3, building: "Fazendas", target: 3 },
      { day: 4, building: "Habitacoes", target: 3 },
      { day: 4, building: "Muralha", target: 3 },
    ];
  }

  return [
    { day: 1, building: "Fazendas", target: 2 },
    { day: 1, building: "Habitacoes", target: 2 },
    { day: 2, building: "Minas", target: 2 },
    { day: 2, building: "Palacio", target: 2 },
    { day: 3, building: "Fazendas", target: 3 },
    { day: 3, building: "Habitacoes", target: 3 },
    { day: 4, building: "Minas", target: 3 },
    { day: 4, building: "Palacio", target: 3 },
  ];
}

function buildWonderDays(player) {
  const days = [];

  if (player.wondersD90 > 0) {
    const start = Math.max(42, player.firstVillage100Day + 4);
    const span = Math.max(8, 88 - start);
    const gap = span / Math.max(1, player.wondersD90);
    for (let i = 0; i < player.wondersD90; i += 1) {
      days.push(Math.min(90, Math.round(start + i * gap)));
    }
  }

  const lateWonders = Math.max(0, player.wondersD120 - player.wondersD90);
  if (lateWonders > 0) {
    const start = 96;
    const span = 20;
    const gap = span / Math.max(1, lateWonders);
    for (let i = 0; i < lateWonders; i += 1) {
      days.push(Math.min(118, Math.round(start + i * gap)));
    }
  }

  return days;
}

function buildActionTimeline(player) {
  const timeline = [];
  const openingPlan = openingPlanForProfile(player.profileKey);

  for (const step of openingPlan) {
    pushTimelineAction(
      timeline,
      step.day,
      "upgrade",
      `${step.building} -> Nv ${step.target}`,
      "Abertura padrao da build para liberar economia e identidade do arquétipo.",
    );
  }

  if (player.explorationSorties > 0) {
    pushTimelineAction(
      timeline,
      Math.max(4, player.secondVillageDay - 4),
      "explore",
      `Buscas e coletas (${player.explorationSorties})`,
      `Raid score ${player.raidLootScore} e bonus de exploracao ${player.explorationBonus}.`,
    );
  }

  pushTimelineAction(
    timeline,
    Math.max(5, player.secondVillageDay - 2),
    "recruit",
    "Formou a primeira reserva militar na Capital",
    `Projecao de ${troopsAtDay(player, 15).toLocaleString("pt-BR")} tropas ate D15.`,
  );

  pushTimelineAction(
    timeline,
    player.secondVillageDay,
    "expand",
    "Conquistou/Fundou a 2a aldeia",
    `Marco de expansao principal da run. Distancia ao centro: ${player.distanceToCenterHex} hex.`,
  );

  const checkpoint30 = player.checkpoints[30];
  const checkpoint60 = player.checkpoints[60];
  const checkpoint90 = player.checkpoints[90];
  const checkpoint120 = player.checkpoints[120];

  if (checkpoint30?.villages >= 3) {
    pushTimelineAction(
      timeline,
      30,
      "expand",
      `Chegou a ${checkpoint30.villages} aldeias`,
      `Influencia ${checkpoint30.influenceTotal} e ${checkpoint30.troops.toLocaleString("pt-BR")} tropas no D30.`,
    );
  }

  pushTimelineAction(
    timeline,
    player.firstVillage100Day,
    "upgrade",
    "Primeira aldeia atingiu 100/100",
    "A partir daqui a run pode converter desenvolvimento em teto de score e Maravilha.",
  );

  for (const slot of player.councilSlots ?? []) {
    const copies = (player.councilSlots ?? []).filter((entry) => entry.heroKey === slot.heroKey && entry.day <= slot.day).length;
    pushTimelineAction(
      timeline,
      slot.day,
      "hero",
      `Contratou ${HERO_DEFS[slot.heroKey].label}${copies > 1 ? ` (${copies}a vaga)` : ""}`,
      `Especialista alinhado com a branch ${player.branchKey}.`,
    );
  }

  for (let i = 0; i < QUEST_DAYS.length; i += 1) {
    if (!player.quests[i]) {
      continue;
    }
    pushTimelineAction(
      timeline,
      QUEST_DAYS[i],
      "quest",
      `Concluiu Quest ${i + 1}/3`,
      `Quest fechada na fase ${phaseLabelForDay(QUEST_DAYS[i])}.`,
    );
  }

  const wonderDays = buildWonderDays(player);
  wonderDays.forEach((day, index) => {
    pushTimelineAction(
      timeline,
      day,
      "wonder",
      `Ergueu/garantiu Maravilha ${index + 1}`,
      "Maravilha depende de Engenheiro e base economica madura.",
    );
  });

  if (checkpoint60?.villages >= 5) {
    pushTimelineAction(
      timeline,
      60,
      "expand",
      `Mid game com ${checkpoint60.villages} aldeias`,
      `Influencia ${checkpoint60.influenceTotal}, tropas ${checkpoint60.troops.toLocaleString("pt-BR")}.`,
    );
  }

  if (player.tribeDome) {
    pushTimelineAction(
      timeline,
      91,
      "tribe",
      "Ativou Domo da Tribo",
      "Bônus tribal convertido em score de sobrevivencia no late game.",
    );
  }

  if (checkpoint90?.villages >= 7) {
    pushTimelineAction(
      timeline,
      90,
      "expand",
      `Chegou ao D90 com ${checkpoint90.villages} aldeias`,
      `Influencia ${checkpoint90.influenceTotal} e ${checkpoint90.troops.toLocaleString("pt-BR")} tropas.`,
    );
  }

  if (player.villageLosses > 0) {
    pushTimelineAction(
      timeline,
      HORDE_SPIKE_DAY,
      "horde",
      `Horda rompeu ${player.villageLosses} aldeias`,
      `A run caiu de ${player.villagesD90} para ${player.villagesD120} aldeias no fim.`,
    );
  } else {
    pushTimelineAction(
      timeline,
      HORDE_SPIKE_DAY,
      "horde",
      "Horda contida sem perda de aldeia",
      `Muralha, execucao e timing seguraram a pressao do apocalipse.`,
    );
  }

  if (player.villagesLostToPvp > 0) {
    pushTimelineAction(
      timeline,
      Math.max(94, player.groupingDay + 8),
      "expand",
      `Perdeu ${player.villagesLostToPvp} cidade(s) para PvP`,
      "Ataques de outros soberanos romperam parte do imperio no late game.",
    );
  }

  pushTimelineAction(
    timeline,
    player.groupingDay,
    "group",
    "Agrupamento liberado na Capital",
    "A partir daqui o jogador pode converter império em marcha final.",
  );

  pushTimelineAction(
    timeline,
    player.marchStartDay,
    "march",
    "Iniciou marcha ao Portal",
    `ETA ${player.etaHours}h; influencia projetada no fim ${player.influenceD120}.`,
  );

  const arrivalDay = Math.min(120, Math.round(player.marchStartDay + player.etaHours / 24));
  const outcomeDetail =
    player.enteredPortal
      ? `Entrou no Portal com ${player.influenceD120} de influencia.`
      : player.portalBlockReason === "pvp_eliminated"
        ? "Foi eliminado por ataques de outros jogadores antes de fechar a marcha final."
      : player.portalBlockReason === "eta_late"
        ? `Falhou por ETA. Distancia ${player.distanceToCenterHex} hex, marcha tardia ou sem logistica suficiente.`
        : player.portalBlockReason === "intercepted"
          ? "Falhou por interceptacao na trilha final. Faltou sinergia de branch/herois para segurar a marcha."
        : `Barrado por influencia insuficiente (${player.influenceD120}).`;

  pushTimelineAction(
    timeline,
    arrivalDay,
    "outcome",
    player.enteredPortal ? "Entrou no Portal" : "Falhou no endgame",
    outcomeDetail,
  );

  return timeline.sort((a, b) => (a.day - b.day) || (actionPriority(a.type) - actionPriority(b.type)) || a.action.localeCompare(b.action));
}

function inferScenarioPreset(scenarioId) {
  if (scenarioId.endsWith("perfect")) return "perfect";
  if (scenarioId.endsWith("lazy")) return "faulty";
  if (scenarioId.endsWith("faulty")) return "faulty";
  return null;
}

function selectRepresentativeRecord(run) {
  const scenarioPreset = inferScenarioPreset(run.scenarioId);
  let candidates = run.records.filter((record) => record.profile === run.focusProfile);

  if (scenarioPreset) {
    const primaryCandidates = candidates.filter((record) => record.isPrimaryScenarioPlayer);
    if (primaryCandidates.length > 0) {
      candidates = primaryCandidates;
    }

    const presetCandidates = candidates.filter((record) => record.skillPreset === scenarioPreset);
    if (presetCandidates.length > 0) {
      candidates = presetCandidates;
    }
  }

  if (candidates.length === 0) {
    candidates = run.records;
  }

  return [...candidates].sort((a, b) => {
    const scoreA =
      (a.enteredPortal ? 1_000_000 : 0) +
      a.influenceD120 * 100 +
      a.maxInfluenceObserved * 10 +
      a.questCount * 1_000 +
      a.wondersD120 * 900 +
      a.troopsAlive -
      a.villagesLostToHorde * 500;
    const scoreB =
      (b.enteredPortal ? 1_000_000 : 0) +
      b.influenceD120 * 100 +
      b.maxInfluenceObserved * 10 +
      b.questCount * 1_000 +
      b.wondersD120 * 900 +
      b.troopsAlive -
      b.villagesLostToHorde * 500;
    return scoreB - scoreA;
  })[0];
}

function selectProfileRepresentativeFromRecords(records, profileKey) {
  const group = records.filter((record) => record.profile === profileKey);
  if (group.length === 0) {
    return null;
  }

  const targetInfluence = avg(group, (record) => record.influenceD120);
  return [...group].sort((a, b) => {
    const diffA = Math.abs(a.influenceD120 - targetInfluence);
    const diffB = Math.abs(b.influenceD120 - targetInfluence);
    if (diffA !== diffB) {
      return diffA - diffB;
    }
    if (a.enteredPortal !== b.enteredPortal) {
      return Number(b.enteredPortal) - Number(a.enteredPortal);
    }
    return b.influenceD120 - a.influenceD120;
  })[0];
}

function pushCheckpointBreakdownTable(lines, record) {
  lines.push("| Dia | Total | Predios | Militar | Conselho | Quests | Maravilhas | Tribo | Aldeias | Tropas |");
  lines.push("| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const day of CHECKPOINT_DAYS) {
    const point = record.checkpoints[day];
    lines.push(`| ${day} | ${point.influenceTotal} | ${point.buildings} | ${point.military} | ${point.council} | ${point.quests} | ${point.wonders} | ${point.tribe} | ${point.villages} | ${point.troops.toLocaleString("pt-BR")} |`);
  }
  lines.push("");
}

function formatHeroLoadout(record) {
  const counts = record.heroCounts ?? Object.fromEntries(HERO_KEYS.map((hero) => [hero, 0]));
  return HERO_KEYS
    .filter((hero) => (counts[hero] ?? 0) > 0)
    .map((hero) => `${HERO_DEFS[hero].label} x${counts[hero]}`)
    .join(", ");
}

function buildInfluenceBreakdownReport(runs) {
  const lines = [];
  const records = flattenRecords(runs);

  lines.push("# KingsWorld - Quebra de Influencia por Area");
  lines.push("");
  lines.push("- Cada tabela separa a Influencia em `Predios`, `Militar`, `Conselho`, `Quests`, `Maravilhas` e `Tribo`.");
  lines.push("- O total continua travado em 2500 e o corte do Portal continua em 1500.");
  lines.push("");
  lines.push(`## Media geral do modo atual (${SEED_MODE})`);
  lines.push("");
  lines.push("| Dia | Total medio | Predios | Militar | Conselho | Quests | Maravilhas | Tribo | Aldeias | Tropas |");
  lines.push("| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const day of CHECKPOINT_DAYS) {
    const points = records.map((record) => record.checkpoints[day]);
    lines.push(`| ${day} | ${round(avg(points, (point) => point.influenceTotal), 2)} | ${round(avg(points, (point) => point.buildings), 2)} | ${round(avg(points, (point) => point.military), 2)} | ${round(avg(points, (point) => point.council), 2)} | ${round(avg(points, (point) => point.quests), 2)} | ${round(avg(points, (point) => point.wonders), 2)} | ${round(avg(points, (point) => point.tribe), 2)} | ${round(avg(points, (point) => point.villages), 2)} | ${round(avg(points, (point) => point.troops), 2)} |`);
  }
  lines.push("");
  lines.push("## Representantes normais por perfil");
  lines.push("");

  for (const profileKey of PROFILE_KEYS) {
    const record = selectProfileRepresentativeFromRecords(records, profileKey);
    if (!record) {
      continue;
    }

    lines.push(`### ${PROFILE_DEFS[profileKey].label}`);
    lines.push("");
    lines.push(`- Seed: ${record.seed}`);
    lines.push(`- Cenario: ${record.scenarioId}`);
    lines.push(`- Branch: ${record.branch}`);
    lines.push(`- Resultado: ${record.enteredPortal ? `Entrou (${record.influenceD120})` : `Falhou (${record.influenceD120})`}`);
    lines.push(`- 2a aldeia: D${record.secondVillageDay} | 1a aldeia 100: D${record.firstVillage100Day} | ETA: ${record.etaHours}h`);
    lines.push("");
    pushCheckpointBreakdownTable(lines, record);
  }

  const capRecords = records
    .filter((record) => record.maxInfluenceObserved >= INFLUENCE_CAP)
    .sort((a, b) => b.influenceD120 - a.influenceD120 || b.troopsAlive - a.troopsAlive)
    .slice(0, 4);

  if (capRecords.length > 0) {
    lines.push("## Builds que bateram 2500");
    lines.push("");
    for (const record of capRecords) {
      lines.push(`### ${PROFILE_DEFS[record.profile].label} - ${record.scenarioId}`);
      lines.push("");
      lines.push(`- Seed: ${record.seed}`);
      lines.push(`- Branch: ${record.branch}`);
      lines.push(`- Resultado final: ${record.influenceD120} influencia | ${record.villagesD120} aldeias | ${record.troopsAlive.toLocaleString("pt-BR")} tropas`);
      lines.push(`- Conselho: ${formatHeroLoadout(record) || "nenhum"}`);
      lines.push("");
      pushCheckpointBreakdownTable(lines, record);
    }
  }

  return `${lines.join("\n")}\n`;
}

function buildActionTimelineReport(runs) {
  const lines = [];
  lines.push("# KingsWorld - Timeline de Acoes por Seed");
  lines.push("");
  lines.push("- Cada seed abaixo mostra um representante da build foco daquela simulacao.");
  lines.push("- A timeline e reconstruida a partir de marcos reais: expansao, herois, quests, maravilhas, horda, agrupamento e marcha.");
  lines.push("- Nao e log de clique literal; e a melhor trilha explicativa que o motor atual consegue provar.");
  lines.push("");

  for (const run of runs) {
    const record = selectRepresentativeRecord(run);
    lines.push(`## Seed ${run.seed} - ${run.scenarioId}`);
    lines.push("");
    lines.push(`- Representante: ${record.id}`);
    lines.push(`- Perfil: ${PROFILE_DEFS[record.profile].label}`);
    lines.push(`- Branch: ${record.branch}`);
    lines.push(`- Resultado: ${record.enteredPortal ? "Entrou" : `Falhou (${record.portalBlockReason})`}`);
    lines.push(`- Influencia D15/D30/D60/D90/D120: ${record.checkpoints[15].influenceTotal}/${record.checkpoints[30].influenceTotal}/${record.checkpoints[60].influenceTotal}/${record.checkpoints[90].influenceTotal}/${record.influenceD120}`);
    lines.push(`- 2a aldeia: D${record.secondVillageDay} | 1a aldeia 100: D${record.firstVillage100Day} | ETA: ${record.etaHours}h`);
    lines.push("");
    lines.push("| Dia | Fase | Tipo | Acao | Detalhe |");
    lines.push("| ---: | --- | --- | --- | --- |");
    for (const item of record.actionTimeline) {
      lines.push(`| ${item.day} | ${item.phase} | ${item.type} | ${item.action} | ${item.detail} |`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function groupTimelineByDay(timeline) {
  const map = new Map();
  for (const item of timeline) {
    if (!map.has(item.day)) {
      map.set(item.day, []);
    }
    map.get(item.day).push(item);
  }
  return map;
}

function baseDailyFocus(record, day) {
  if (day <= 4) {
    return "Abrir economia e eixo principal da build sem espalhar recurso.";
  }

  if (day < record.secondVillageDay) {
    return "Juntar recurso para a 2a aldeia, manter coletas e formar reserva militar basica na Capital.";
  }

  if (day < record.firstVillage100Day) {
    return "Expandir sem perder ritmo e puxar uma aldeia para 100/100 o quanto antes.";
  }

  if (day < 90) {
    return "Converter desenvolvimento em score: herois, quests, maravilhas e mais aldeias.";
  }

  if (day < record.marchStartDay) {
    return "Agrupar na Capital e confirmar que a Influencia final continua acima de 1500.";
  }

  if (day < 120) {
    return "Marcha final em curso: nao perder tempo, nao quebrar logistica, nao cair abaixo do gate do Portal.";
  }

  return record.enteredPortal
    ? "Run concluida com sucesso no Portal."
    : `Run falhou por ${record.portalBlockReason}.`;
}

function branchLabel(branch) {
  if (branch === "urban") return "Urbana";
  if (branch === "tactical") return "Tatica";
  if (branch === "defensive") return "Defensiva";
  return "Fluxo";
}

function stageForDay(record, day) {
  if (day <= 4) return "opening";
  if (day < record.secondVillageDay) return "prep_second";
  if (day < record.firstVillage100Day) return "prep_first100";
  if (day < 90) return "scale_score";
  if (day < record.marchStartDay) return "prep_march";
  if (day <= 120) return "final_march";
  return "done";
}

function inferOptimalDailyPriorities(record, day, dayEvents) {
  const stage = stageForDay(record, day);
  const priorities = [];
  const branch = branchLabel(record.branch);
  const longSpawn = record.distanceToCenterHex >= 56;
  const hasEventType = (type) => dayEvents.some((item) => item.type === type);

  if (hasEventType("expand")) {
    priorities.push("Garantir recursos e influencia para expansao sem travar a Capital.");
  }
  if (hasEventType("hero")) {
    priorities.push("Fechar contratacao do heroi e realinhar a build ao bonus dele.");
  }
  if (hasEventType("quest")) {
    priorities.push("Virar o dia com a quest concluida e nao perder o timing da era.");
  }
  if (hasEventType("wonder")) {
    priorities.push("Funilar materiais/energia para concluir a Maravilha sem quebrar o fluxo.");
  }
  if (hasEventType("group")) {
    priorities.push("Ativar reagrupar e puxar todo o poder util para a Capital.");
  }
  if (hasEventType("march")) {
    priorities.push("Marchar so com ETA e score final confirmados acima do gate.");
  }
  if (hasEventType("horde")) {
    priorities.push("Chamar tudo para defesa e proteger as aldeias que ainda contam para score.");
  }

  if (stage === "opening") {
    if (record.profile === "metropole") {
      priorities.push("Subir Minas/Fazendas e o eixo Palacio/Senado em paralelo curto.");
      priorities.push("Nao gastar cedo demais com tropa; priorizar aceleração estrutural.");
      priorities.push("Preparar a capital para a 2a aldeia antes do D15.");
    } else if (record.profile === "posto") {
      priorities.push("Subir Minas/Fazendas e destravar Quartel/Arsenal logo no inicio.");
      priorities.push("Vasculhar arredores para converter saque em ritmo de build.");
      priorities.push("Criar a primeira massa de ataque na Capital.");
    } else if (record.profile === "bastiao") {
      priorities.push("Subir Minas/Fazendas junto de Habitacoes/Muralha.");
      priorities.push("Nao superinvestir em defesa passiva antes da 2a aldeia.");
      priorities.push("Formar guarnicao minima sem atrasar o core da aldeia.");
    } else {
      priorities.push("Subir Fazendas/Habitacoes e estabilizar fluxo interno desde o inicio.");
      priorities.push("Usar a folga economica para chegar na 2a aldeia o mais cedo possivel.");
      priorities.push("Evitar gasto militar acima do necessario no early.");
    }
  } else if (stage === "prep_second") {
    priorities.push("Juntar recurso para a 2a aldeia.");
    priorities.push("Fazer buscas/coletas sem atrasar o salto territorial.");
    priorities.push("Recrutar um lote leve na Capital para nao ficar nu no mapa.");
  } else if (stage === "prep_first100") {
    if (record.profile === "metropole") {
      priorities.push("Escolher uma aldeia foco e funilar tudo nela ate 100/100.");
      priorities.push(`Empurrar pesquisa ${branch} enquanto abre 3a/4a aldeia sem atrasar o core.`);
      priorities.push("Manter tropas apenas no volume necessario para segurar a expansao.");
    } else if (record.profile === "posto") {
      priorities.push("Converter agressao em aldeias e marcos, nao so em combate vazio.");
      priorities.push("Subir Quartel/Arsenal enquanto uma aldeia foco corre para 100/100.");
      priorities.push(`Empurrar pesquisa ${branch} e recrutar lote medio na Capital.`);
    } else if (record.profile === "bastiao") {
      priorities.push("Subir aldeia foco 100/100 sem abandonar muralha e habitacoes.");
      priorities.push("Segurar defesa boa, mas sem cair na armadilha de so defender.");
      priorities.push(`Empurrar pesquisa ${branch} e preparar Engenheiro/Navegador se necessario.`);
    } else {
      priorities.push("Doar recursos internamente para acelerar a aldeia foco.");
      priorities.push("Abrir Intendente/Fluxo cedo para transformar economia em tempo.");
      priorities.push("Chegar ao 100/100 antes de desperdiçar recurso em sobra parada.");
    }
  } else if (stage === "scale_score") {
    if (record.profile === "metropole") {
      priorities.push("Transformar aldeia 100 em cadeia de Maravilha.");
      priorities.push("Fechar conselho completo e quests de era.");
      priorities.push("Subir aldeias restantes sem quebrar o teto de score estrutural.");
    } else if (record.profile === "posto") {
      priorities.push("Converter poder militar em score: quest, expansao e dominio util.");
      priorities.push("Subir a qualidade das tropas na Capital e nao apenas o volume.");
      priorities.push("Abrir Maravilhas assim que Engenheiro permitir.");
    } else if (record.profile === "bastiao") {
      priorities.push("Trocar parte da gordura defensiva por execucao real de score.");
      priorities.push("Fechar Maravilhas/quests sem deixar a malha logistica morrer.");
      priorities.push(longSpawn ? "Garantir Navegador o quanto antes." : "Manter ETA final sob controle.");
    } else {
      priorities.push("Maximizar doacao interna x5 entre aldeias e Capital.");
      priorities.push("Fechar Maravilhas em cadeia antes da janela final.");
      priorities.push("Concluir pesquisa Flow e abrir Navegador para nao morrer no ETA.");
    }
  } else if (stage === "prep_march") {
    priorities.push("Reagrupar imperio na Capital e consolidar tropas.");
    priorities.push("Parar upgrades supérfluos em aldeias perifericas.");
    priorities.push("Confirmar que o score final segue >=1500 mesmo com perdas.");
  } else if (stage === "final_march") {
    priorities.push("Marcha em curso: preservar score e tempo.");
    priorities.push("So gastar recurso em manutencao critica de sobrevivencia.");
    priorities.push("Evitar qualquer desvio que nao aumente a chance de tocar o Portal.");
  } else {
    priorities.push(baseDailyFocus(record, day));
  }

  const unique = [];
  for (const item of priorities) {
    if (!unique.includes(item)) {
      unique.push(item);
    }
  }
  return unique.slice(0, 3);
}

function buildProfileRotation(profile, stage) {
  if (stage === "prep_march" || stage === "final_march") {
    return [];
  }

  if (profile === "metropole") {
    return stage === "scale_score"
      ? ["Palacio", "Senado", "Centro de Pesquisa", "Habitacoes", "Minas"]
      : ["Minas", "Fazendas", "Palacio", "Senado", "Centro de Pesquisa"];
  }

  if (profile === "posto") {
    return stage === "scale_score"
      ? ["Quartel", "Arsenal", "Minas", "Palacio", "Centro de Pesquisa"]
      : ["Minas", "Fazendas", "Quartel", "Arsenal", "Palacio"];
  }

  if (profile === "bastiao") {
    return stage === "scale_score"
      ? ["Muralha", "Habitacoes", "Palacio", "Centro de Pesquisa", "Minas"]
      : ["Minas", "Fazendas", "Habitacoes", "Muralha", "Palacio"];
  }

  return stage === "scale_score"
    ? ["Fazendas", "Habitacoes", "Centro de Pesquisa", "Palacio", "Minas"]
    : ["Fazendas", "Habitacoes", "Minas", "Palacio", "Centro de Pesquisa"];
}

function createPlannerState(record) {
  const opening = openingPlanForProfile(record.profile);
  const state = {
    levels: {
      Minas: 1,
      Fazendas: 1,
      Palacio: 1,
      Senado: 1,
      Quartel: 1,
      Arsenal: 1,
      Habitacoes: 1,
      Muralha: 1,
      "Centro de Pesquisa": 1,
      Maravilha: 0,
    },
    villageCount: 1,
    wonderCount: 0,
    rotationIndex: 0,
  };

  for (const step of opening) {
    state.levels[step.building] = Math.max(state.levels[step.building] ?? 1, step.target);
  }

  return state;
}

function nextRotationUpgrade(state, record, stage) {
  const rotation = buildProfileRotation(record.profile, stage);
  if (rotation.length === 0) {
    return null;
  }

  for (let tries = 0; tries < rotation.length; tries += 1) {
    const building = rotation[state.rotationIndex % rotation.length];
    state.rotationIndex += 1;
    const current = state.levels[building] ?? 1;
    if (current >= 10) {
      continue;
    }
    state.levels[building] = current + 1;
    return `${building} foco -> Nv ${state.levels[building]}`;
  }

  return null;
}

function estimateRecruitDelta(record, day) {
  if (day <= 1) return 0;
  return Math.max(0, troopsAtDay(record, day) - troopsAtDay(record, day - 1));
}

function imperativeFromEvent(event) {
  if (event.type === "hero") return event.action;
  if (event.type === "quest") return event.action;
  if (event.type === "wonder") return event.action;
  if (event.type === "expand") return event.action;
  if (event.type === "group") return "Ativar reagrupar na Capital";
  if (event.type === "march") return "Disparar marcha final ao Portal";
  if (event.type === "horde") return event.action;
  if (event.type === "explore") return "Rodar buscas e coletas";
  if (event.type === "recruit") return "Recrutar lote principal na Capital";
  return event.action;
}

function buildConcreteDayActions(record, day, state, dayEvents) {
  const stage = stageForDay(record, day);
  const actions = [];

  for (const event of dayEvents) {
    actions.push(imperativeFromEvent(event));
    if (event.type === "expand") {
      state.villageCount = Math.min(10, Math.max(state.villageCount + 1, villageCountAtDay(record, day)));
    }
    if (event.type === "wonder") {
      state.wonderCount += 1;
      state.levels.Maravilha = state.wonderCount;
    }
  }

  if (stage === "opening") {
    if (actions.length === 0) {
      const up1 = nextRotationUpgrade(state, record, stage);
      const up2 = nextRotationUpgrade(state, record, stage);
      if (up1) actions.push(up1);
      if (up2) actions.push(up2);
    }
  } else if (stage === "prep_second") {
    const up = nextRotationUpgrade(state, record, stage);
    if (up) actions.push(up);
    if (!dayEvents.some((item) => item.type === "explore")) {
      actions.push("Rodar buscas e coletas");
    }
    const recruit = estimateRecruitDelta(record, day);
    if (recruit > 0 && !dayEvents.some((item) => item.type === "recruit")) {
      actions.push(`Recrutar ~${recruit.toLocaleString("pt-BR")} tropas na Capital`);
    }
  } else if (stage === "prep_first100") {
    const up1 = nextRotationUpgrade(state, record, stage);
    const up2 = nextRotationUpgrade(state, record, stage);
    if (up1) actions.push(up1);
    if (up2) actions.push(up2);
    if (day % 3 === 0 && !dayEvents.some((item) => item.type === "explore")) {
      actions.push("Vasculhar arredores para saque e bonus de exploracao");
    }
    const recruit = estimateRecruitDelta(record, day);
    if (recruit > 0 && day % 2 === 0) {
      actions.push(`Recrutar ~${recruit.toLocaleString("pt-BR")} tropas na Capital`);
    }
  } else if (stage === "scale_score") {
    const up = nextRotationUpgrade(state, record, stage);
    if (up) actions.push(up);

    if (record.profile === "metropole" && !dayEvents.some((item) => item.type === "wonder")) {
      actions.push("Doar recursos internos para a aldeia foco de Maravilha");
    } else if (record.profile === "posto") {
      actions.push("Pressionar mapa e transformar combate em expansao ou quest");
    } else if (record.profile === "bastiao") {
      actions.push("Subir defesa util sem sacrificar a execucao de score");
    } else {
      actions.push("Doar recursos internos x5 para acelerar aldeia foco");
    }

    const recruit = estimateRecruitDelta(record, day);
    if (recruit > 0) {
      actions.push(`Recrutar ~${recruit.toLocaleString("pt-BR")} tropas na Capital`);
    }
  } else if (stage === "prep_march") {
    actions.push("Doar recursos das aldeias perifericas para a Capital");
    actions.push("Chamar todas as tropas para a Capital");
    actions.push("Parar upgrades perifericos e manter so o essencial");
  } else if (stage === "final_march") {
    actions.push("Sustentar a marcha sem abrir novas frentes");
    actions.push("Usar apenas apoio e doacao critica de sobrevivencia");
    actions.push("Preservar score >= 1500 ate tocar o Portal");
  }

  const unique = [];
  for (const action of actions) {
    if (!unique.includes(action)) {
      unique.push(action);
    }
  }

  if (unique.length === 0) {
    if (stage === "prep_first100") {
      unique.push("Transferir recursos para a aldeia foco");
      unique.push("Recrutar lote leve na Capital");
      unique.push("Vasculhar arredores");
    } else if (stage === "scale_score") {
      unique.push("Doar recursos internos para acelerar score");
      unique.push("Recrutar reposicao na Capital");
      unique.push("Fechar micro-ajustes da build sem abrir desvio");
    } else if (stage === "prep_march") {
      unique.push("Doar recursos das periferias para a Capital");
      unique.push("Chamar todas as tropas para a Capital");
      unique.push("Congelar upgrades periféricos");
    } else if (stage === "final_march") {
      unique.push("Manter marcha viva e score acima do corte");
      unique.push("Nao abrir nova aldeia nem novo gasto estrutural");
      unique.push("Usar apenas apoio critico");
    } else {
      unique.push("Rodar coleta");
      unique.push("Recrutar lote leve na Capital");
      unique.push("Preparar o proximo salto da build");
    }
  }

  return unique.slice(0, 5);
}

function profileDailyFocus(record, day) {
  const base = baseDailyFocus(record, day);

  if (record.profile === "metropole") {
    if (day < record.firstVillage100Day) {
      return `${base} Prioridade extra: Palacio, Senado e primeira aldeia 100.`;
    }
    return `${base} Prioridade extra: manter cadeia de Maravilhas e teto de predios.`;
  }

  if (record.profile === "posto") {
    if (day < 60) {
      return `${base} Prioridade extra: transformar pressao militar em expansao util e quest.`;
    }
    return `${base} Prioridade extra: manter militar alto sem sacrificar score estrutural.`;
  }

  if (record.profile === "bastiao") {
    if (day < 90) {
      return `${base} Prioridade extra: segurar muralha boa, mas sem virar defesa passiva.`;
    }
    return `${base} Prioridade extra: trocar seguranca excessiva por execucao e ETA viavel.`;
  }

  if (day < 90) {
    return `${base} Prioridade extra: usar fluxo interno para acelerar a run inteira.`;
  }
  return `${base} Prioridade extra: logistica manda mais que sobra de recurso.`;
}

function summarizeDayActions(dayEvents) {
  if (!dayEvents || dayEvents.length === 0) {
    return "Sem marco novo.";
  }
  return dayEvents.map((item) => item.action).join(" + ");
}

function hydrateRecordForProgression(record) {
  return {
    ...record,
    profile: PROFILE_DEFS[record.profile],
    heroes:
      record.heroStates ??
      Object.fromEntries(
        HERO_KEYS.map((hero) => [
          hero,
          {
            hired: record.heroes.includes(hero),
            day: record.heroHireDay?.[hero] ?? Number.POSITIVE_INFINITY,
            count: record.heroCounts?.[hero] ?? record.heroes.filter((entry) => entry === hero).length,
            days: record.heroStates?.[hero]?.days ?? [],
          },
        ]),
      ),
    quests:
      record.questStates ??
      [0, 1, 2].map((index) => index < (record.questCount ?? 0)),
  };
}

function formatMargin(value) {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function buildDailyPlaybookReport(runs) {
  const lines = [];
  lines.push("# KingsWorld - Playbook Diario de Execucao");
  lines.push("");
  lines.push("- Arquivo focado nas runs `perfect` do modo `paired8`.");
  lines.push("- Cada linha mostra o que fazer naquele dia na versao mais eficiente observada pelo simulador.");
  lines.push("- Quando nao ha marco novo, o foco do dia indica a melhor continuacao da build.");
  lines.push("- A coluna `Margem` mostra quao longe a run estava do corte do Portal (1500).");
  lines.push("");

  const perfectRuns = runs.filter((run) => run.scenarioId.endsWith("perfect"));

  for (const run of perfectRuns) {
    const record = selectRepresentativeRecord(run);
    const progression = hydrateRecordForProgression(record);
    const byDay = groupTimelineByDay(record.actionTimeline);

    lines.push(`## ${PROFILE_DEFS[record.profile].label} - ${run.scenarioId}`);
    lines.push("");
    lines.push(`- Seed: ${run.seed}`);
    lines.push(`- Branch: ${record.branch}`);
    lines.push(`- 2a aldeia: D${record.secondVillageDay}`);
    lines.push(`- 1a aldeia 100: D${record.firstVillage100Day}`);
    lines.push(`- Marcha: D${record.marchStartDay} | ETA ${record.etaHours}h`);
    lines.push(`- Resultado: ${record.enteredPortal ? `Portal com ${record.influenceD120}` : `Falha (${record.portalBlockReason})`}`);
    lines.push("");
    lines.push("| Dia | Infl. | Margem | Aldeias | Tropas | Prioridade 1 | Prioridade 2 | Prioridade 3 | Marco real do dia |");
    lines.push("| ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- |");

    for (let day = 1; day <= 120; day += 1) {
      const dayEvents = byDay.get(day) ?? [];
      const priorities = inferOptimalDailyPriorities(record, day, dayEvents);
      const dayMarks = summarizeDayActions(dayEvents);
      const influence = influenceAtDay(progression, day).total;
      const villages = villageCountAtDay(progression, day);
      const troops = troopsAtDay(progression, day);
      lines.push(`| ${day} | ${influence} | ${formatMargin(influence - PORTAL_CUT)} | ${villages} | ${troops.toLocaleString("pt-BR")} | ${priorities[0] ?? "-"} | ${priorities[1] ?? "-"} | ${priorities[2] ?? "-"} | ${dayMarks} |`);
    }

    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function buildDailyExecutorReport(runs) {
  const lines = [];
  lines.push("# KingsWorld - Executor Diario Otimo (Runs Perfect)");
  lines.push("");
  lines.push("- Arquivo prescritivo baseado nas runs `perfect` do modo `paired8`.");
  lines.push("- Cada dia mostra a melhor lista pratica de acoes para repetir a build vencedora.");
  lines.push("- Aqui a prioridade ja vem convertida em execucao concreta.");
  lines.push("- Todas as seeds deste arquivo sao vencedoras por design; use o `action_timelines` para comparar com as `lazy`.");
  lines.push("- A coluna `Margem` mostra quando a build realmente encosta ou passa do corte 1500.");
  lines.push("");

  const perfectRuns = runs.filter((run) => run.scenarioId.endsWith("perfect"));

  for (const run of perfectRuns) {
    const record = selectRepresentativeRecord(run);
    const progression = hydrateRecordForProgression(record);
    const byDay = groupTimelineByDay(record.actionTimeline);
    const plannerState = createPlannerState(record);

    lines.push(`## ${PROFILE_DEFS[record.profile].label} - ${run.scenarioId}`);
    lines.push("");
    lines.push(`- Seed: ${run.seed}`);
    lines.push(`- Branch: ${record.branch}`);
    lines.push(`- 2a aldeia: D${record.secondVillageDay}`);
    lines.push(`- 1a aldeia 100: D${record.firstVillage100Day}`);
    lines.push(`- D90: ${record.checkpoints[90].influenceTotal} influencia (${formatMargin(record.checkpoints[90].influenceTotal - PORTAL_CUT)}) | ${record.checkpoints[90].villages} aldeias | ${record.checkpoints[90].troops.toLocaleString("pt-BR")} tropas`);
    lines.push(`- D120: ${record.influenceD120} influencia (${formatMargin(record.influenceD120 - PORTAL_CUT)}) | ${record.villagesD120} aldeias | ${record.troopsAlive.toLocaleString("pt-BR")} tropas`);
    lines.push("");
    lines.push("| Dia | Infl. | Margem | Aldeias | Tropas | Execucao ideal do dia | Marco real |");
    lines.push("| ---: | ---: | ---: | ---: | ---: | --- | --- |");

    for (let day = 1; day <= 120; day += 1) {
      const dayEvents = byDay.get(day) ?? [];
      const actions = buildConcreteDayActions(record, day, plannerState, dayEvents);
      const marks = summarizeDayActions(dayEvents);
      const influence = influenceAtDay(progression, day).total;
      const villages = villageCountAtDay(progression, day);
      const troops = troopsAtDay(progression, day);
      lines.push(`| ${day} | ${influence} | ${formatMargin(influence - PORTAL_CUT)} | ${villages} | ${troops.toLocaleString("pt-BR")} | ${actions.join(" + ")} | ${marks} |`);
    }

    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function toCsv(rows, headers) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    const serialized = headers.map((header) => {
      const value = row[header];
      if (value === null || value === undefined) return "";
      const text = String(value);
      if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
        return `"${text.replaceAll("\"", "\"\"")}"`;
      }
      return text;
    });
    lines.push(serialized.join(","));
  }
  return `${lines.join("\n")}\n`;
}

function okFlag(ok) {
  return ok ? "OK" : "AJUSTAR";
}

function buildReport(data) {
  const {
    lock,
    runTable,
    checkpointsSummary,
    profileSummary,
    branchSummary,
    heroSummary,
    balance,
    scenarioCount,
    scenarioLabel,
  } = data;
  const lines = [];
  lines.push("# KingsWorld - Relatorio V4 (Escassez, Horda e Influencia 2500)");
  lines.push("");
  lines.push("## Regras aplicadas");
  lines.push("");
  lines.push("- Influencia fixa 2500 (Regicida removido): Predios 1000 + Militar 500 + Quests 300 + Conselho 250 + Maravilhas 250 + Tribo 200.");
  lines.push("- Teto de tropas por imperio limitado entre 1.5k e 2.5k no pico da temporada.");
  lines.push("- Custo de treino e upkeep modelados em escala 10x e economia com escassez.");
  lines.push("- Horda 91+ com mortalidade elevada e perda real de aldeias perifericas.");
  lines.push("- ETA para o Centro depende de Navegador + Branch Fluxo para cair em ~48h-60h.");
  lines.push("");
  lines.push("## Validacao dos alvos");
  lines.push("");
  lines.push(`- 2a aldeia media perto do Dia 15: ${round(lock.avgSecondVillageDay, 2)} (${okFlag(Math.abs(lock.avgSecondVillageDay - TARGETS.secondVillageDay) <= 1.4)}).`);
  lines.push(`- 1a aldeia nivel 100 media perto do Dia 45: ${round(lock.avgFirstVillage100Day, 2)} (${okFlag(Math.abs(lock.avgFirstVillage100Day - TARGETS.firstVillage100Day) <= 2.5)}).`);
  lines.push(`- Sobreviventes no Portal por seed (alvo ~15): ${round(lock.avgPortalSurvivors, 2)} (${okFlag(Math.abs(lock.avgPortalSurvivors - TARGETS.portalSurvivorsPerSeed) <= 2.5)}).`);
  lines.push(`- Elegiveis >=1500 no Dia 90 por seed: ${round(lock.avgDay90Eligible, 2)}.`);
  lines.push(`- Mortes PvP por seed: ${round(avg(runTable, (row) => row.pvpDeaths), 2)}.`);
  lines.push(`- Players com pico 2500 por seed: ${round(lock.avgReached2500, 2)}.`);
  lines.push("");
  lines.push(`## Tabela de validacao - ${scenarioCount} seeds (${scenarioLabel})`);
  lines.push("");
  lines.push("| Seed | Cenario | Perfil foco | Portal | Vivos D120 | D90 >=1500 | Pico 2500 | Mortes PvP | Mortes trilha | Perda media aldeias (total) | Herois medios | ETA medio (h) |");
  lines.push("| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const row of runTable) {
    lines.push(`| ${row.seed} | ${row.scenario} | ${PROFILE_DEFS[row.focusProfile].label} | ${row.portalSurvivors} | ${row.finalAlive} | ${row.day90Eligible} | ${row.reached2500} | ${row.pvpDeaths} | ${row.trailDeaths} | ${row.avgVillagesLostTotal} | ${row.avgHeroes} | ${row.avgEta} |`);
  }
  lines.push("");
  lines.push("## Progressao media (dias 15, 30, 60, 90, 120)");
  lines.push("");
  lines.push("| Dia | Players vivos | Elegiveis >=1500 | Influencia media | Predios | Militar | Conselho | Quests | Maravilhas | Tribo | Tropas medias | Aldeias medias |");
  lines.push("| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const point of checkpointsSummary) {
    lines.push(`| ${point.day} | ${point.avgPlayersAlive} | ${point.avgEligiblePortal} | ${point.avgInfluence} | ${point.avgBuildingInfluence} | ${point.avgMilitaryInfluence} | ${point.avgCouncilInfluence} | ${point.avgQuestInfluence} | ${point.avgWonderInfluence} | ${point.avgTribeInfluence} | ${point.avgTroops} | ${point.avgVillages} |`);
  }
  lines.push("");
  lines.push("## Eficacia das Branches de Pesquisa");
  lines.push("");
  lines.push("| Branch | Players | Taxa Portal | D90 >=1500 | Pico 2500 | Infl. D90 | Infl. D120 | ETA medio (h) | Morte trilha | Perda aldeias Horda |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const row of branchSummary) {
    lines.push(`| ${row.branch} | ${row.players} | ${row.portalRatePct}% | ${row.day90EligibleRatePct}% | ${row.reached2500RatePct}% | ${row.avgInfluenceD90} | ${row.avgInfluenceD120} | ${row.avgEtaHours} | ${row.trailDeathRatePct}% | ${row.avgVillagesLostToHorde} |`);
  }
  lines.push("");
  lines.push("## Dados uteis dos 5 Herois Especialistas");
  lines.push("");
  lines.push("| Heroi | Adocao | Media de vagas | Dia medio contratacao | Taxa portal (usuarios) | Taxa portal (nao usuarios) | Delta (pp) | ETA medio usuarios (h) | Infl. D120 usuarios |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const row of heroSummary) {
    lines.push(`| ${row.label} | ${row.adoptionRatePct}% | ${row.avgCopiesUsers} | ${row.avgHireDay || "-"} | ${row.portalRateUsersPct}% | ${row.portalRateNonUsersPct}% | ${row.portalDeltaPp} | ${row.avgEtaUsers || "-"} | ${row.avgInfluenceD120Users} |`);
  }
  lines.push("");
  lines.push("## Resultado por estilo de capital");
  lines.push("");
  lines.push("| Estilo | Players | Portal | Infl. D90 | Infl. D120 | Tropas D120 | Aldeias perdidas Horda | 2a aldeia media | 1a aldeia 100 media | Pico 2500 |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const row of profileSummary) {
    lines.push(`| ${row.label} | ${row.players} | ${row.portalRatePct}% | ${row.avgInfluenceD90} | ${row.avgInfluenceD120} | ${row.avgTroopsD120} | ${row.avgVillagesLostToHorde} | ${row.avgSecondVillageDay} | ${row.avgFirstVillage100Day} | ${row.reached2500RatePct}% |`);
  }
  lines.push("");
  lines.push("## Ajustes aplicados");
  lines.push("");
  lines.push(`- branchBuffUrban: ${balance.branchBuffUrban}`);
  lines.push(`- branchBuffFlow: ${balance.branchBuffFlow}`);
  lines.push(`- portalDeathBase: ${balance.portalDeathBase}`);
  lines.push(`- hordeLossBase: ${balance.hordeLossBase}`);
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function buildCalibrationFocusReport(previousFocus, currentFocus) {
  const lines = [];
  lines.push("# KingsWorld - Calibragem Final (ETA e Maravilha)");
  lines.push("");
  lines.push("## ETA para Centro (Navegador + Branch Flow)");
  lines.push("");

  if (previousFocus?.etaNavigatorFlowAvg) {
    lines.push(`- Antes: ${round(previousFocus.etaNavigatorFlowAvg, 2)}h`);
  } else if (previousFocus?.etaFlowBranchAvg) {
    lines.push(`- Antes (media da Branch Flow): ${round(previousFocus.etaFlowBranchAvg, 2)}h`);
  } else {
    lines.push("- Antes: n/d");
  }

  lines.push(`- Depois (Navegador + Flow): ${round(currentFocus.etaNavigatorFlowAvg, 2)}h (P90: ${round(currentFocus.etaNavigatorFlowP90, 2)}h)`);
  lines.push(`- % no alvo 48-60h: ${round(currentFocus.etaNavigatorFlowInTargetPct, 2)}%`);
  lines.push("");
  lines.push("## Impacto do Custo 3x de Maravilhas (pico 2500)");
  lines.push("");

  if (typeof previousFocus?.reached2500PerSeed === "number") {
    lines.push(`- Antes: ${round(previousFocus.reached2500PerSeed, 2)} players/seed em pico 2500`);
  } else {
    lines.push("- Antes: n/d");
  }

  lines.push(`- Depois: ${round(currentFocus.reached2500PerSeed, 2)} players/seed em pico 2500`);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function main() {
  const previousResultsPath = path.join(OUTPUT_DIR, `${OUTPUT_BASENAME}_results.json`);
  let previousResults = null;

  if (fs.existsSync(previousResultsPath)) {
    try {
      previousResults = JSON.parse(fs.readFileSync(previousResultsPath, "utf8"));
    } catch {
      previousResults = null;
    }
  }

  const calibrated = runCalibrated();
  const runs = calibrated.runs;
  const records = flattenRecords(runs);

  const runTable = summarizeRunTable(runs);
  const checkpointsSummary = summarizeCheckpoints(runs);
  const phaseWindows = summarizePhaseWindows(checkpointsSummary);
  const profileSummary = summarizeByProfile(records);
  const branchSummary = summarizeByBranch(records);
  const heroSummary = summarizeHeroes(records);
  const calibrationFocus = summarizeCalibrationFocus(records, calibrated.lock, branchSummary);

  const previousFocus = {
    etaNavigatorFlowAvg:
      previousResults?.calibrationFocus?.etaNavigatorFlowAvg ??
      previousResults?.branchSummary?.find((row) => row.branch === "flow")?.avgEtaHours ??
      null,
    etaFlowBranchAvg:
      previousResults?.calibrationFocus?.etaFlowBranchAvg ??
      previousResults?.branchSummary?.find((row) => row.branch === "flow")?.avgEtaHours ??
      null,
    reached2500PerSeed:
      typeof previousResults?.lock?.avgReached2500 === "number"
        ? previousResults.lock.avgReached2500
        : null,
  };

  const results = {
    metadata: {
      generatedAt: new Date().toISOString(),
      seeds: SCENARIOS.map((scenario) => scenario.seed),
      scenarios: SCENARIOS,
      world: WORLD,
      checkpoints: CHECKPOINT_DAYS,
      scoreWeights: SCORE_WEIGHTS,
      influenceCap: INFLUENCE_CAP,
      portalCut: PORTAL_CUT,
      tuning: {
        raidLootMult: RAID_LOOT_MULT,
        battleLossMult: BATTLE_LOSS_MULT,
        wallPeakMult: WALL_PEAK_MULT,
        pvpDeathMult: PVP_DEATH_MULT,
      },
      moveTimes: {
        baseMoveTimeMinutes: BASE_MOVE_TIME_MINUTES,
        roadMoveTimeMinutes: ROAD_MOVE_TIME_MINUTES,
        phase4LogisticsMult: PHASE4_LOGISTICS_MULT,
      },
    },
    calibrationIteration: calibrated.iteration,
    lock: calibrated.lock,
    balance: calibrated.balance,
    runTable,
    checkpointsSummary,
    phaseWindows,
    profileSummary,
    branchSummary,
    heroSummary,
    calibrationFocus,
    runsDetailed: runs.map((run) => ({
      seed: run.seed,
      scenarioId: run.scenarioId,
      focusProfile: run.focusProfile,
      records: run.records,
    })),
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const scenarioLabel =
    runs.length === 8 && runs.every((run) => run.records[0]?.skillPreset)
      ? "2 por perfil (1 perfeito + 1 com falhas)"
      : `${Math.round(runs.length / PROFILE_KEYS.length)} por perfil`;

  const report = buildReport({
    lock: calibrated.lock,
    runTable,
    checkpointsSummary,
    profileSummary,
    branchSummary,
    heroSummary,
    calibrationFocus,
    balance: calibrated.balance,
    scenarioCount: runs.length,
    scenarioLabel,
  });

  const focusReport = buildCalibrationFocusReport(previousFocus, calibrationFocus);
  const actionTimelineReport = buildActionTimelineReport(runs);
  const influenceBreakdownReport = buildInfluenceBreakdownReport(runs);
  const dailyPlaybookReport = buildDailyPlaybookReport(runs);
  const dailyExecutorReport = buildDailyExecutorReport(runs);

  const runCsv = toCsv(runTable, [
    "seed",
    "scenario",
    "focusProfile",
    "portalSurvivors",
    "finalAlive",
    "day90Eligible",
    "reached2500",
    "hordeDeaths",
    "pvpDeaths",
    "trailDeaths",
    "avgVillagesLostToHorde",
    "avgVillagesLostTotal",
    "avgTroops",
    "avgHeroes",
    "avgEta",
    "dominantBranch",
    "avgSecondVillageDay",
    "avgFirstVillage100Day",
  ]);

  const profileCsv = toCsv(profileSummary, [
    "profile",
    "label",
    "players",
    "portalRatePct",
    "avgInfluenceD90",
    "avgInfluenceD120",
    "avgTroopsD120",
    "avgVillagesLostToHorde",
    "avgSecondVillageDay",
    "avgFirstVillage100Day",
    "reached2500RatePct",
  ]);

  const auditCsv = toCsv(
    [...branchSummary.map((row) => ({ type: "branch", ...row })), ...heroSummary.map((row) => ({ type: "hero", ...row }))],
    [
      "type",
      "branch",
      "hero",
      "label",
      "players",
      "users",
      "portalRatePct",
      "day90EligibleRatePct",
      "reached2500RatePct",
      "avgInfluenceD90",
      "avgInfluenceD120",
      "avgEtaHours",
      "avgVillagesLostToHorde",
      "trailDeathRatePct",
      "adoptionRatePct",
      "avgHireDay",
      "portalRateUsersPct",
      "portalRateNonUsersPct",
      "portalDeltaPp",
      "avgEtaUsers",
      "avgInfluenceD120Users",
    ],
  );

  const checkpointsCsv = toCsv(checkpointsSummary, [
    "day",
    "avgPlayersAlive",
    "avgEligiblePortal",
    "avgInfluence",
    "avgBuildingInfluence",
    "avgMilitaryInfluence",
    "avgCouncilInfluence",
    "avgQuestInfluence",
    "avgWonderInfluence",
    "avgTribeInfluence",
    "avgTroops",
    "avgVillages",
  ]);

  const phaseCsv = toCsv(phaseWindows, [
    "phase",
    "start",
    "end",
    "avgInfluence",
    "avgEligiblePortal",
    "avgTroops",
    "avgVillages",
  ]);

  fs.writeFileSync(path.join(OUTPUT_DIR, `${OUTPUT_BASENAME}_report.md`), report);
  fs.writeFileSync(path.join(OUTPUT_DIR, `${OUTPUT_BASENAME}_focus_report.md`), focusReport);
  fs.writeFileSync(path.join(OUTPUT_DIR, `${OUTPUT_BASENAME}_action_timelines.md`), actionTimelineReport);
  fs.writeFileSync(path.join(OUTPUT_DIR, `${OUTPUT_BASENAME}_influence_breakdown.md`), influenceBreakdownReport);
  fs.writeFileSync(path.join(OUTPUT_DIR, `${OUTPUT_BASENAME}_daily_playbooks.md`), dailyPlaybookReport);
  fs.writeFileSync(path.join(OUTPUT_DIR, `${OUTPUT_BASENAME}_daily_executor.md`), dailyExecutorReport);
  fs.writeFileSync(path.join(OUTPUT_DIR, `${OUTPUT_BASENAME}_results.json`), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, `${OUTPUT_BASENAME}_multi_seed.csv`), runCsv);
  fs.writeFileSync(path.join(OUTPUT_DIR, `${OUTPUT_BASENAME}_profiles.csv`), profileCsv);
  fs.writeFileSync(path.join(OUTPUT_DIR, `${OUTPUT_BASENAME}_audit.csv`), auditCsv);
  fs.writeFileSync(path.join(OUTPUT_DIR, `${OUTPUT_BASENAME}_daily.csv`), checkpointsCsv);
  fs.writeFileSync(path.join(OUTPUT_DIR, `${OUTPUT_BASENAME}_phase_windows.csv`), phaseCsv);

  const summary = [
    "Simulacao concluida.",
    `Iteracao de calibragem: ${calibrated.iteration}`,
    `Media 2a aldeia: ${round(calibrated.lock.avgSecondVillageDay, 2)}`,
    `Media 1a aldeia 100: ${round(calibrated.lock.avgFirstVillage100Day, 2)}`,
    `Media sobreviventes no Portal/seed: ${round(calibrated.lock.avgPortalSurvivors, 2)}`,
    `Media elegiveis >=1500 no D90/seed: ${round(calibrated.lock.avgDay90Eligible, 2)}`,
    `ETA Navegador+Flow (media): ${round(calibrationFocus.etaNavigatorFlowAvg, 2)}h`,
    `Pico 2500 por seed: ${round(calibrationFocus.reached2500PerSeed, 2)}`,
  ];
  console.log(summary.join("\n"));
}

main();
