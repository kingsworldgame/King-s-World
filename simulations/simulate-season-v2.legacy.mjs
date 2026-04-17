import fs from "node:fs";
import path from "node:path";

const WORLD = {
  days: 120,
  humans: 8,
  bots: 42,
  players: 50,
  seedCount: 20,
  seedStart: 90712026,
  seedStep: 7919,
};

const CHECKPOINT_DAYS = [15, 30, 60, 90, 120];
const PHASE_WINDOWS = [
  { name: "I: Consolidacao", start: 1, end: 20 },
  { name: "II: Expansao", start: 21, end: 60 },
  { name: "III: Fortificacao", start: 61, end: 90 },
  { name: "IV: Exodo", start: 91, end: 120 },
];

const OUTPUT_DIR = path.join(process.cwd(), "simulations", "output");
const OUTPUT_BASENAME = "season_v2_120d";

const INFLUENCE_CAP = 2500;
const PORTAL_CUT = 1500;
const REGICIDE_POINTS = 100;
const REGICIDE_CAP = 3;
const TARGET_DAY90_INFLUENCE = 1550;
const TARGET_DAY90_ELIGIBLE = 12.5;
const TARGET_FIRST_CONQUEST_DAY = 15;
const TARGET_FIRST_V100_DAY = 45;
const TARGET_PORTAL_2500_ENTRANTS = 15;
const TARGET_STYLE_PARITY_DELTA = 10;

const BASE_MOVE_TIME_MINUTES = 45;
const ROAD_MOVE_TIME_MINUTES = 15;
const PHASE4_LOGISTICS_MULT = 5;
const HORDES_INTERCEPT_MULT = 3;
const ALL_IN_DAY = 109;

const PROFILE_DEFS = {
  metropole: {
    label: "Metropole", economy: 1.28, supplies: 1.08, military: 0.92, defense: 1.04,
    aggression: 0.5, logistics: 1.0, expansion: 1.1, buildRate: 3, councilEase: 1.08,
    maxVillages: 10, regroupDay: 101, buildFocus: 1.16, attackCostMult: 1.02, raidPower: 0.95,
    regicideChanceBonus: 0.08, wallMastery: 1.05, hordeShield: 1.05,
  },
  posto: {
    label: "Posto Avancado", economy: 0.98, supplies: 0.96, military: 1.24, defense: 0.95,
    aggression: 0.86, logistics: 1.1, expansion: 1.14, buildRate: 0, councilEase: 0.88,
    maxVillages: 10, regroupDay: 96, buildFocus: 0.98, attackCostMult: 0.52, raidPower: 1.35,
    regicideChanceBonus: 0.22, wallMastery: 0.92, hordeShield: 0.95,
  },
  bastiao: {
    label: "Bastiao", economy: 0.94, supplies: 1.08, military: 1.1, defense: 1.45,
    aggression: 0.48, logistics: 0.9, expansion: 0.92, buildRate: 1, councilEase: 0.94,
    maxVillages: 9, regroupDay: 103, buildFocus: 1.03, attackCostMult: 0.88, raidPower: 1.02,
    regicideChanceBonus: 0.1, wallMastery: 1.72, hordeShield: 1.62,
  },
  celeiro: {
    label: "Celeiro", economy: 1.16, supplies: 1.34, military: 0.82, defense: 1.03,
    aggression: 0.44, logistics: 0.96, expansion: 1.0, buildRate: 2, councilEase: 1.0,
    maxVillages: 10, regroupDay: 104, buildFocus: 1.0, attackCostMult: 0.96, raidPower: 0.9,
    regicideChanceBonus: 0.06, wallMastery: 1.0, hordeShield: 1.08,
  },
};

const PROFILE_KEYS = Object.keys(PROFILE_DEFS);

const INITIAL_BALANCE = {
  productionMult: 1.0,
  upgradeCostMult: 1.05,
  expansionCostMult: 1.0,
  trainingCostMult: 1.12,
  attackCostMult: 0.92,
  heroCostMult: 1.0,
  hordeLethality: 1.05,
  peripheryHordeMult: 1.15,
  bastionWallBuff: 1.28,
  buildActionMult: 0.72,
};

const HERO_TYPES = ["Spy", "WarLeader", "Diplomat", "General", "Hero", "Engineer", "Agriculturist"];

function buildSeeds(count, start, step) {
  return Array.from({ length: count }, (_, index) => start + index * step);
}

function buildSeedScenarios(countPerStyle, start, step) {
  const scenarios = [];
  let seed = start;
  for (const style of PROFILE_KEYS) {
    for (let i = 0; i < countPerStyle; i += 1) {
      scenarios.push({
        id: style + "-" + (i + 1),
        seed,
        capitalStyle: style,
      });
      seed += step;
    }
  }
  return scenarios;
}

const WORLD_SEED_SCENARIOS = buildSeedScenarios(5, WORLD.seedStart, WORLD.seedStep);
const WORLD_SEEDS = WORLD_SEED_SCENARIOS.map((scenario) => scenario.seed);

function mulberry32(seed) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (value, digits = 0) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const sum = (items, selector = (item) => item) => items.reduce((acc, item) => acc + selector(item), 0);
const avg = (items, selector = (item) => item) => (items.length ? sum(items, selector) / items.length : 0);

function weightedPick(items, weightOf, rng) {
  const valid = items.filter(Boolean);
  if (!valid.length) return null;
  const weights = valid.map((item) => Math.max(0.0001, weightOf(item)));
  const total = sum(weights);
  let ticket = rng() * total;
  for (let i = 0; i < valid.length; i += 1) {
    ticket -= weights[i];
    if (ticket <= 0) return valid[i];
  }
  return valid[valid.length - 1] ?? null;
}

function readPath(obj, pathKey) {
  const keys = pathKey.split(".");
  let cursor = obj;
  for (const key of keys) {
    if (cursor === null || cursor === undefined) return 0;
    cursor = cursor[key];
  }
  return typeof cursor === "number" ? cursor : 0;
}

function createVillage(id, isCapital, level) {
  return { id, isCapital, level: clamp(Math.floor(level), 0, 100), active: true };
}

function createPlayer(index, isHuman, rng, options = {}) {
  const forcedProfile = options.capitalStyle && PROFILE_DEFS[options.capitalStyle] ? options.capitalStyle : null;
  const profileKey = forcedProfile ?? PROFILE_KEYS[index % PROFILE_KEYS.length];
  const profileConfig = PROFILE_DEFS[profileKey];
  const capitalStart = round(9 + rng() * 6 + profileConfig.economy * 2.5);
  const startTroops = round(280 + rng() * 110 + profileConfig.military * 130 + (isHuman ? 40 : 0));

  return {
    id: `${isHuman ? "H" : "B"}${String(index + 1).padStart(2, "0")}`,
    name: `${isHuman ? "Humano" : "Bot"} ${index + 1}`,
    type: isHuman ? "Humano" : "Bot",
    isHuman,
    profileKey,
    profileConfig,
    capitalStyle: forcedProfile ?? profileKey,
    alive: true,
    kingAlive: true,
    enteredPortal: false,
    portalResolved: false,
    kingsKilled: 0,
    wondersControlled: 0,
    questComplete: false,
    councilHeroes: 0,
    heroRoster: [],
    militaryRanking: 80,
    activeDome: false,
    activeResilience: false,
    villages: [createVillage("capital", true, capitalStart)],
    lostVillages: 0,
    exodusAbandoned: 0,
    routes: 0,
    resources: {
      materials: round(2400 + rng() * 900),
      energy: round(1700 + rng() * 700),
      supplies: round(1900 + rng() * 700),
    },
    troopsAlive: startTroops,
    startingTroops: startTroops,
    troopsTrained: 0,
    troopsDeadPvp: 0,
    troopsDeadPve: 0,
    lootFromRaids: 0,
    spend: {
      upgrades: 0,
      expansion: 0,
      troops: 0,
      raids: 0,
      heroes: 0,
    },
    king: {
      distanceToCenter: round(24 + rng() * 56),
      marching: false,
      gathering: false,
      regroupIssued: false,
      regroupDay: null,
      delayDays: 0,
      marchDisqualified: false,
      atPortal: false,
    },
    milestones: {
      secondVillageDay: null,
      firstVillage100Day: capitalStart >= 100 ? 1 : null,
    },
    snapshots: {},
    influence: {
      building: 0,
      king: 0,
      council: 0,
      military: 0,
      regicide: 0,
      wonder: 0,
      quest: 0,
      domeTribe: 0,
      conquestActive: 0,
      total: 0,
    },
    maxInfluenceObserved: 0,
  };
}

function activeVillages(player) { return player.villages.filter((village) => village.active); }
function countActiveVillages(player) { return activeVillages(player).length; }
function getCapital(player) { return player.villages.find((village) => village.isCapital) ?? null; }
function getEmpireLevel(player) { return sum(activeVillages(player), (village) => village.level); }

function weakestNonCapitalVillage(player) {
  const candidates = activeVillages(player).filter((village) => !village.isCapital);
  if (!candidates.length) return null;
  return candidates.sort((a, b) => a.level - b.level)[0] ?? null;
}

function getWallDefenseBonus(player, day, balance) {
  const capital = getCapital(player);
  const level = capital && capital.active ? capital.level : 0;
  const phaseBoost = day >= 61 ? 14 : 6;
  const normalized = clamp((level + phaseBoost) / 100, 0, 1);
  const mastery = player.profileConfig.wallMastery;
  const bastionExtra = player.profileKey === "bastiao" ? balance.bastionWallBuff : 1;
  return 1 + normalized * 0.42 * mastery * bastionExtra;
}

function isPeripheral(player) {
  return player.king.distanceToCenter > 26 && countActiveVillages(player) >= 4;
}

function capturePlayerSnapshot(player, day) {
  player.snapshots[day] = {
    day,
    influenceTotal: player.influence.total,
    buildingInfluence: player.influence.building,
    councilInfluence: player.influence.council,
    militaryInfluence: player.influence.military,
    regicideInfluence: player.influence.regicide,
    wonderInfluence: player.influence.wonder,
    questInfluence: player.influence.quest,
    domeInfluence: player.influence.domeTribe,
    conquestActiveInfluence: player.influence.conquestActive,
    villagesActive: countActiveVillages(player),
    levelTotal: getEmpireLevel(player),
    councilHeroes: player.councilHeroes,
    materials: round(player.resources.materials),
    energy: round(player.resources.energy),
    supplies: round(player.resources.supplies),
    troopsAlive: round(player.troopsAlive),
    roads: player.routes,
    distanceToCenter: round(player.king.distanceToCenter, 2),
  };
}
function calculateInfluence(player, day) {
  const building = clamp(round(getEmpireLevel(player)), 0, 1000);
  const king = player.kingAlive ? 200 : 0;
  const council = clamp(player.councilHeroes, 0, 4) * 100;
  const militaryBase = clamp(round(player.militaryRanking), 0, 200);
  const militaryCommand = clamp((player.councilHeroes >= 4 ? 45 : player.councilHeroes * 10) + (player.kingsKilled >= 2 ? 20 : 0), 0, 65);
  const military = clamp(militaryBase + militaryCommand, 0, 200);

  const regicide = clamp(player.kingsKilled, 0, 3) * REGICIDE_POINTS;
  const wonder = clamp(player.wondersControlled, 0, 4) * 50;
  const quest = player.questComplete ? 100 : 0;

  const conquestActive = clamp(regicide + wonder + quest, 0, 600);
  const domeTribe = day >= 91 && player.activeDome ? 100 : 0;

  return {
    building,
    king,
    council,
    military,
    regicide,
    wonder,
    quest,
    domeTribe,
    conquestActive,
    total: clamp(building + king + council + military + conquestActive + domeTribe, 0, INFLUENCE_CAP),
  };
}

function updateMilitaryRanking(players) {
  const alive = players.filter((player) => player.alive);
  if (!alive.length) return;
  const sorted = [...alive].sort((a, b) => b.troopsAlive - a.troopsAlive);
  const maxIndex = Math.max(1, sorted.length - 1);
  sorted.forEach((player, index) => {
    const ratio = 1 - index / maxIndex;
    player.militaryRanking = clamp(round((0.35 + ratio * 0.65) * 200), 0, 200);
  });
}

function targetCapitalLevel(day, player) {
  let base = 100;
  if (day <= 45) base = 12 + day * 1.95;
  const focusAdjustment = (player.profileConfig.buildFocus - 1) * 10;
  return clamp(base + focusAdjustment, 0, 100);
}

function targetColonyLevel(day, player) {
  let base = 100;
  if (day <= 30) base = 8 + day * 0.55;
  else if (day <= 60) base = 24.5 + (day - 30) * 1.15;
  else if (day <= 90) base = 59 + (day - 60) * 1.15;
  else base = 93.5 + (day - 90) * 0.3;
  const focusAdjustment = (player.profileConfig.buildFocus - 1) * 8;
  return clamp(base + focusAdjustment, 0, 100);
}

function nextUpgradeCost(level, balance, player) {
  const growth = 1 + level / 45;
  const baseMaterials = (66 + level * 4.8) * growth * balance.upgradeCostMult;
  const baseEnergy = (40 + level * 3.3) * growth * balance.upgradeCostMult;
  const profileDiscount = 1 / clamp(0.94 + (player.profileConfig.buildFocus - 1) * 0.25, 0.86, 1.08);

  return {
    materials: round(baseMaterials * profileDiscount),
    energy: round(baseEnergy * profileDiscount),
  };
}

function dailyProductionStep(player, balance) {
  const villages = activeVillages(player);
  if (!villages.length) return;

  const villageCount = villages.length;
  const avgLevel = avg(villages, (village) => village.level);

  const matGain = villageCount * (220 * player.profileConfig.economy + avgLevel * 8.6) * balance.productionMult;
  const energyGain = villageCount * (192 * player.profileConfig.economy + avgLevel * 7.2) * balance.productionMult;
  const suppliesGain = villageCount * (186 * player.profileConfig.supplies + avgLevel * 6.5) * balance.productionMult;

  const upkeep = player.troopsAlive * (0.038 + (1 - player.profileConfig.defense) * 0.02) + villageCount * 22;

  player.resources.materials += round(matGain);
  player.resources.energy += round(energyGain);
  player.resources.supplies += round(suppliesGain - upkeep);

  if (player.resources.supplies < 0) {
    const shortage = Math.abs(player.resources.supplies);
    const losses = Math.max(1, round(shortage * 0.22));
    player.troopsAlive = Math.max(0, player.troopsAlive - losses);
    player.troopsDeadPve += losses;
    player.resources.supplies = 0;
  }

  if (player.resources.energy < 0) player.resources.energy = 0;
}

function upgradeStep(player, day, balance) {
  const phase = day <= 20 ? 1 : day <= 60 ? 2 : day <= 90 ? 3 : 4;
  let actions = phase === 1 ? 6 : phase === 2 ? 6 : phase === 3 ? 7 : 4;
  actions += player.profileConfig.buildRate;
  actions += Math.floor(countActiveVillages(player) / 2);
  if (player.isHuman) actions += 1;
  actions = Math.max(1, Math.floor(actions * balance.buildActionMult));
  actions = clamp(actions, 1, 16);

  while (actions > 0) {
    actions -= 1;
    const villages = activeVillages(player);
    if (!villages.length) return;

    const capital = getCapital(player);
    const capitalTarget = targetCapitalLevel(day, player);
    const colonyTarget = targetColonyLevel(day, player);

    let chosen = null;

    if (capital && capital.active && capital.level < capitalTarget) {
      chosen = capital;
    } else {
      chosen = villages
        .filter((village) => !village.isCapital && village.level < colonyTarget)
        .sort((a, b) => a.level - b.level)[0] ?? null;

      if (!chosen) {
        chosen = villages
          .filter((village) => village.level < 100)
          .sort((a, b) => a.level - b.level)[0] ?? null;
      }
    }

    if (!chosen) return;

    const cost = nextUpgradeCost(chosen.level, balance, player);
    if (player.resources.materials < cost.materials || player.resources.energy < cost.energy) return;

    player.resources.materials -= cost.materials;
    player.resources.energy -= cost.energy;
    player.spend.upgrades += cost.materials + cost.energy;

    chosen.level = clamp(Math.floor(chosen.level + 1), 0, 100);

    if (chosen.isCapital && chosen.level >= 100 && player.milestones.firstVillage100Day === null) {
      player.milestones.firstVillage100Day = day;
    }
  }
}

function expansionStep(player, day, balance, rng, totals) {
  if (day < 12 || !player.alive) return;
  const activeCount = countActiveVillages(player);
  if (activeCount >= player.profileConfig.maxVillages) return;

  const capital = getCapital(player);
  if (!capital || !capital.active) return;

  const requiredCapital = 18 + activeCount * 3;
  if (capital.level < requiredCapital) return;

  const expansionDivisor = clamp(player.profileConfig.expansion, 0.78, 1.35);
  const materials = round((400 + activeCount * 280) * balance.expansionCostMult / expansionDivisor);
  const energy = round((240 + activeCount * 180) * balance.expansionCostMult / expansionDivisor);

  if (player.resources.materials < materials || player.resources.energy < energy) return;

  const expansionChance = clamp(0.42 + player.profileConfig.expansion * 0.16 + (day >= 20 ? 0.12 : 0), 0.3, 0.85);
  if (rng() > expansionChance) return;

  player.resources.materials -= materials;
  player.resources.energy -= energy;
  player.spend.expansion += materials + energy;

  const villageId = `col-${player.villages.length + 1}`;
  const openingLevel = round(12 + rng() * 10 + player.profileConfig.buildFocus * 3.5);
  player.villages.push(createVillage(villageId, false, openingLevel));
  player.routes += 1;

  if (activeCount + 1 === 2 && player.milestones.secondVillageDay === null) {
    player.milestones.secondVillageDay = day;
  }

  totals.expansions += 1;
}

function nextHeroCost(player, balance) {
  const nextHeroIndex = player.councilHeroes + 1;
  const profileDiscount = 1 / clamp(player.profileConfig.councilEase, 0.8, 1.2);

  const materials = round((480 + nextHeroIndex * 340) * balance.heroCostMult * profileDiscount);
  const energy = round((320 + nextHeroIndex * 250) * balance.heroCostMult * profileDiscount);
  const supplies = round((260 + nextHeroIndex * 210) * balance.heroCostMult * profileDiscount);

  return { materials, energy, supplies };
}

function heroStep(player, day, balance, rng) {
  if (day < 24 || !player.alive) return;
  if (player.councilHeroes >= 4) return;

  const nextHeroIndex = player.councilHeroes + 1;
  const requiredDayByTier = [24, 40, 56, 72];
  if (day < requiredDayByTier[nextHeroIndex - 1]) return;

  const requiredEmpireLevel = 140 + (nextHeroIndex - 1) * 170;
  if (getEmpireLevel(player) < requiredEmpireLevel) return;

  const cost = nextHeroCost(player, balance);
  if (
    player.resources.materials < cost.materials
    || player.resources.energy < cost.energy
    || player.resources.supplies < cost.supplies
  ) {
    return;
  }

  const hireChance = clamp(0.27 + player.profileConfig.councilEase * 0.18 + (day >= 70 ? 0.1 : 0), 0.22, 0.86);
  if (rng() > hireChance) return;

  player.resources.materials -= cost.materials;
  player.resources.energy -= cost.energy;
  player.resources.supplies -= cost.supplies;
  player.spend.heroes += cost.materials + cost.energy + cost.supplies;

  player.councilHeroes += 1;
  const heroType = HERO_TYPES[(nextHeroIndex - 1) % HERO_TYPES.length];
  player.heroRoster.push(heroType);
}

function wonderStep(player, day, rng, totals) {
  if (!player.alive || day < 46) return;
  if (player.wondersControlled >= 4) return;
  if (countActiveVillages(player) < 3) return;

  const next = player.wondersControlled + 1;
  const materialsCost = 180 + next * 120;
  const energyCost = 120 + next * 90;

  if (player.resources.materials < materialsCost || player.resources.energy < energyCost) return;

  const chance = clamp(
    0.02
      + player.profileConfig.aggression * 0.03
      + (player.militaryRanking / 200) * 0.03
      + (player.profileKey === "posto" ? 0.03 : 0)
      + player.kingsKilled * 0.06
      + (day >= 80 ? 0.04 : 0),
    0.02,
    0.55,
  );

  if (rng() > chance) return;

  player.resources.materials -= materialsCost;
  player.resources.energy -= energyCost;
  player.wondersControlled += 1;
  totals.wondersClaimed += 1;
}

function questStep(player, day, rng, totals) {
  if (!player.alive || day < 70 || player.questComplete) return;

  const development = getEmpireLevel(player);
  const villages = countActiveVillages(player);
  const troops = player.troopsAlive;
  const conditionCore = development >= 620 && villages >= 6 && troops >= 1500;
  const conditionProfile = player.councilHeroes >= 3 || player.kingsKilled >= 1 || player.wondersControlled >= 2;

  if (!conditionCore || !conditionProfile) return;

  const chance = clamp(0.35 + player.profileConfig.buildFocus * 0.1 + (day >= 90 ? 0.2 : 0), 0.3, 0.9);
  if (rng() > chance) return;

  player.questComplete = true;
  totals.questsCompleted += 1;
}

function trainTroopsStep(player, day, balance) {
  if (day < 20 || !player.alive) return;

  let phaseIntensity = day <= 20 ? 0.045 : day <= 60 ? 0.07 : day <= 90 ? 0.095 : 0.05;
  if (countActiveVillages(player) === 1 && day < 60) phaseIntensity *= 0.6;

  const matBudget = Math.min(player.resources.materials * phaseIntensity, 1800 * player.profileConfig.military);
  const energyBudget = Math.min(player.resources.energy * phaseIntensity * 0.72, 900);
  const suppliesBudget = Math.min(player.resources.supplies * phaseIntensity * 0.82, 1200);

  const trainable = Math.min(
    matBudget / (4.4 * balance.trainingCostMult),
    energyBudget / (1.95 * balance.trainingCostMult),
    suppliesBudget / (3.15 * balance.trainingCostMult),
  );

  if (trainable < 12) return;

  const troopsGain = round(trainable * (0.78 + player.profileConfig.military * 0.22));
  const materialCost = troopsGain * 4.4 * balance.trainingCostMult;
  const energyCost = troopsGain * 1.95 * balance.trainingCostMult;
  const suppliesCost = troopsGain * 3.15 * balance.trainingCostMult;

  if (
    player.resources.materials < materialCost
    || player.resources.energy < energyCost
    || player.resources.supplies < suppliesCost
  ) {
    return;
  }

  player.resources.materials -= materialCost;
  player.resources.energy -= energyCost;
  player.resources.supplies -= suppliesCost;

  player.spend.troops += materialCost + energyCost + suppliesCost;

  player.troopsAlive += troopsGain;
  player.troopsTrained += troopsGain;
}

function raidMobilizationCost(attacker, day, balance) {
  const phaseFactor = day <= 60 ? 1 : 1.12;
  const profileFactor = attacker.profileConfig.attackCostMult;
  return {
    materials: round(110 * balance.attackCostMult * phaseFactor * profileFactor),
    energy: round(72 * balance.attackCostMult * phaseFactor * profileFactor),
    supplies: round(88 * balance.attackCostMult * phaseFactor * profileFactor),
  };
}

function pvpStep(players, day, balance, rng, totals) {
  if (day < 24) return;

  const alive = players.filter((player) => player.alive && player.troopsAlive > 110);
  if (alive.length < 2) return;

  const engagements = Math.max(1, Math.floor(alive.length * (day <= 60 ? 0.14 : day <= 90 ? 0.17 : 0.12)));

  for (let i = 0; i < engagements; i += 1) {
    const attacker = weightedPick(
      alive,
      (player) => player.troopsAlive * (0.72 + player.profileConfig.aggression * 0.55 + (player.profileKey === "bastiao" ? 0.1 : 0)),
      rng,
    );
    if (!attacker) continue;

    const mobilization = raidMobilizationCost(attacker, day, balance);
    if (
      attacker.resources.materials < mobilization.materials
      || attacker.resources.energy < mobilization.energy
      || attacker.resources.supplies < mobilization.supplies
    ) {
      continue;
    }

    attacker.resources.materials -= mobilization.materials;
    attacker.resources.energy -= mobilization.energy;
    attacker.resources.supplies -= mobilization.supplies;
    attacker.spend.raids += mobilization.materials + mobilization.energy + mobilization.supplies;

    const defenderPool = alive.filter((player) => player.id !== attacker.id);
    const defender = defenderPool[Math.floor(rng() * defenderPool.length)];
    if (!defender) continue;

    const attackPower =
      attacker.troopsAlive
      * (0.9 + rng() * 0.38)
      * attacker.profileConfig.military
      * attacker.profileConfig.raidPower
      * (1 + attacker.kingsKilled * 0.03);

    const defendPower =
      defender.troopsAlive
      * (0.92 + rng() * 0.3)
      * defender.profileConfig.defense
      * (1 + countActiveVillages(defender) * 0.03)
      * getWallDefenseBonus(defender, day, balance);

    const ratio = attackPower / (defendPower + 1);
    const attackerLossRate = clamp(0.035 + (1 / Math.max(0.42, ratio)) * 0.08, 0.025, 0.22);
    const defenderLossRate = clamp(0.05 + ratio * 0.1, 0.04, 0.34);

    const attackerLosses = Math.min(attacker.troopsAlive, Math.max(1, round(attacker.troopsAlive * attackerLossRate)));
    const defenderLosses = Math.min(defender.troopsAlive, Math.max(1, round(defender.troopsAlive * defenderLossRate)));

    attacker.troopsAlive -= attackerLosses;
    defender.troopsAlive -= defenderLosses;

    attacker.troopsDeadPvp += attackerLosses;
    defender.troopsDeadPvp += defenderLosses;

    totals.troopsDeadPvp += attackerLosses + defenderLosses;
    totals.pvpBattles += 1;

    if (ratio > 1.35 && rng() < 0.2) {
      const lostVillage = weakestNonCapitalVillage(defender);
      if (lostVillage) {
        lostVillage.active = false;
        defender.lostVillages += 1;
        totals.villagesTaken += 1;

        const loot = round(260 + lostVillage.level * 12);
        attacker.resources.materials += loot;
        attacker.resources.energy += round(loot * 0.52);
        attacker.lootFromRaids += loot;
      }
    }

    if (ratio > 1.2 && day >= 24 && defender.kingAlive) {
      const regicideChance = clamp(
        0.28 + (ratio - 1.1) * 0.24 + attacker.profileConfig.regicideChanceBonus + (day >= 70 ? 0.1 : 0),
        0.2,
        0.9,
      );

      if (attacker.kingsKilled < REGICIDE_CAP && rng() < regicideChance) {
        attacker.kingsKilled = clamp(attacker.kingsKilled + 1, 0, REGICIDE_CAP);
        totals.regicides += 1;

        const successionChance = day < 90 ? 0.85 : 0.7;
        if (rng() < successionChance) {
          totals.successions += 1;
          defender.kingAlive = true;
          defender.troopsAlive = Math.max(60, round(defender.troopsAlive * 0.9));
        } else {
          defender.kingAlive = false;
        }
      }
    }
  }
}

function successionRecoveryStep(player, day, rng, totals) {
  if (!player.alive || player.kingAlive || day >= 118) return;

  const capital = getCapital(player);
  if (!capital || !capital.active) return;

  const recoveryPower =
    (player.councilHeroes >= 2 ? 0.14 : 0)
    + (capital.level >= 60 ? 0.12 : 0)
    + (countActiveVillages(player) >= 3 ? 0.08 : 0)
    + (player.profileKey === "bastiao" ? 0.06 : 0);

  const chance = clamp(0.25 + recoveryPower, 0.25, 0.86);
  if (rng() > chance) return;

  player.kingAlive = true;
  player.resources.materials = Math.max(0, player.resources.materials - 180);
  player.resources.energy = Math.max(0, player.resources.energy - 120);
  player.troopsAlive = Math.max(80, round(player.troopsAlive * 0.92));
  totals.successions += 1;
}

function refreshPhase4Bonuses(player, day) {
  if (day < 91) {
    player.activeDome = false;
    player.activeResilience = false;
    return;
  }

  player.activeDome = countActiveVillages(player) >= 3 && player.resources.materials >= 2400;
  player.activeResilience = false;
}

function estimateMoveMinutesToCenter(player, { applyPenalty = true } = {}) {
  const villages = countActiveVillages(player);
  const roadCoverage = clamp(((villages - 1) / 9) + player.profileConfig.logistics * 0.34, 0, 1);
  const baseMinutes = BASE_MOVE_TIME_MINUTES - (BASE_MOVE_TIME_MINUTES - ROAD_MOVE_TIME_MINUTES) * roadCoverage;
  const convoyBurden = clamp(1 + villages * 0.18 + player.troopsAlive / 4200, 1, 3.4);
  const regroupPenalty = applyPenalty ? PHASE4_LOGISTICS_MULT : 1;
  return baseMinutes * convoyBurden * regroupPenalty;
}

function issueRegroupOrder(player, day, options, rng, totals) {
  if (!player.alive || !player.kingAlive || player.enteredPortal || day < 91 || player.king.regroupIssued) {
    return;
  }

  const scheduledDay =
    typeof options.forceRegroupDay === "number"
      ? options.forceRegroupDay
      : clamp(player.profileConfig.regroupDay + Math.round((rng() - 0.5) * 8), 91, 114);

  if (day < scheduledDay) return;

  player.king.regroupIssued = true;
  player.king.regroupDay = day;
  player.king.marching = player.king.distanceToCenter > 0;
  player.king.gathering = player.king.marching;
  totals.regroupOrders += 1;
}

function exodusStep(player, day, rng, totals) {
  if (!player.alive || day < 91) return;

  const activeCount = countActiveVillages(player);
  if (activeCount <= 1) return;

  const shouldConsider = day >= 95 || player.king.marching;
  if (!shouldConsider) return;

  const chance = clamp(0.08 + (activeCount - 2) * 0.07 + (player.king.marching ? 0.12 : 0), 0.08, 0.55);
  if (rng() > chance) return;

  const abandoned = weakestNonCapitalVillage(player);
  if (!abandoned) return;

  abandoned.active = false;
  player.lostVillages += 1;
  player.exodusAbandoned += 1;

  player.resources.materials += round(200 + abandoned.level * 10);
  player.resources.energy += round(110 + abandoned.level * 6);
  player.resources.supplies += round(150 + abandoned.level * 7);

  totals.exodusAbandoned += 1;
}

function marchStep(player) {
  if (!player.alive || !player.kingAlive || !player.king.regroupIssued || player.king.atPortal) {
    player.king.gathering = false;
    return;
  }

  if (player.king.delayDays > 0) {
    player.king.delayDays -= 1;
    player.king.gathering = true;
    return;
  }

  const minutesPerTile = estimateMoveMinutesToCenter(player, { applyPenalty: true });
  const tilesToday = Math.max(1, Math.floor(1440 / Math.max(45, minutesPerTile)));

  player.king.distanceToCenter = Math.max(0, player.king.distanceToCenter - tilesToday);
  player.king.marching = player.king.distanceToCenter > 0;
  player.king.gathering = player.king.marching;

  if (player.king.distanceToCenter <= 0) {
    player.king.distanceToCenter = 0;
    player.king.atPortal = true;
    player.king.marching = false;
    player.king.gathering = false;
  }
}

function hordeStep(players, day, balance, runState, rng, totals) {
  if (day < 91) return;

  const baseIntensity = clamp(0.11 + (day - 90) * 0.009, 0.11, 0.5);

  for (const player of players) {
    if (!player.alive || player.enteredPortal) continue;

    const gathering = player.king.gathering;
    const peripheral = isPeripheral(player);
    const overEasyPressure = runState.day90AvgInfluence > 1600 ? 1.2 : 1;
    const peripheryMult = peripheral ? balance.peripheryHordeMult * overEasyPressure : 1;

    const attackChance = clamp(baseIntensity * (gathering ? HORDES_INTERCEPT_MULT : 1) * (peripheral ? 1.08 : 1), 0.08, 0.95);
    if (rng() > attackChance) continue;

    totals.hordeStrikes += 1;
    if (gathering) totals.gatheringInterceptions += 1;

    const defenseFactor =
      player.profileConfig.defense
      * player.profileConfig.hordeShield
      * getWallDefenseBonus(player, day, balance)
      * (1 + countActiveVillages(player) * 0.04);

    const pressure = (0.2 + rng() * 0.34) * balance.hordeLethality * peripheryMult * (gathering ? 1.14 : 1);
    const lossRate = clamp((pressure / Math.max(0.8, defenseFactor)) * 0.15, 0.02, 0.32);
    const losses = Math.min(player.troopsAlive, Math.max(1, round(player.troopsAlive * lossRate)));

    player.troopsAlive -= losses;
    player.troopsDeadPve += losses;
    totals.troopsDeadPve += losses;

    if (gathering && rng() < 0.25) player.king.delayDays += rng() < 0.25 ? 2 : 1;

    const kingKillChance = clamp((0.003 + lossRate * 0.065) * (gathering ? 1.6 : 1), 0.003, 0.2);
    if (player.kingAlive && rng() < kingKillChance) {
      player.kingAlive = false;
      totals.kingsKilledByHorde += 1;
    }

    if (countActiveVillages(player) > 1) {
      const villageRuinChance = clamp(0.03 * peripheryMult / Math.max(1, player.profileConfig.hordeShield), 0.01, 0.12);
      if (rng() < villageRuinChance) {
        const ruinedVillage = weakestNonCapitalVillage(player);
        if (ruinedVillage) {
          ruinedVillage.active = false;
          player.lostVillages += 1;
        }
      }
    }
  }
}

function resolvePortalStep(player, day, totals) {
  if (!player.alive || day < 91) return;

  if (player.king.marching && player.influence.total < PORTAL_CUT) {
    player.king.marchDisqualified = true;
  }

  if (!player.king.atPortal || player.portalResolved) return;

  const blocked = !player.kingAlive || player.king.marchDisqualified || player.influence.total < PORTAL_CUT;
  if (blocked) {
    player.alive = false;
    player.portalResolved = true;
    totals.portalBlocked += 1;
    return;
  }

  player.enteredPortal = true;
  player.portalResolved = true;
  totals.portalEntries += 1;
}

function collapseDay120(players, totals) {
  for (const player of players) {
    if (!player.alive || player.enteredPortal) continue;
    player.alive = false;
    totals.worldCollapse += 1;
  }
}

function countEligibleByProfile(players) {
  const base = {};
  for (const key of PROFILE_KEYS) base[key] = 0;
  for (const player of players) {
    if (player.alive && player.influence.total >= PORTAL_CUT) base[player.profileKey] += 1;
  }
  return base;
}

function captureDaily(players, day) {
  const alive = players.filter((player) => player.alive);
  return {
    day,
    alivePlayers: alive.length,
    villagesActive: sum(players, (player) => countActiveVillages(player)),
    avgLevelTotal: round(avg(alive, (player) => getEmpireLevel(player)), 2),
    avgMilitaryRanking: round(avg(alive, (player) => player.militaryRanking), 2),
    avgInfluence: round(avg(alive, (player) => player.influence.total), 2),
    eligiblePlayers: alive.filter((player) => player.influence.total >= PORTAL_CUT).length,
  };
}

function captureCheckpoint(players, day) {
  const alive = players.filter((player) => player.alive);
  return {
    day,
    alivePlayers: alive.length,
    villagesActive: sum(players, (player) => countActiveVillages(player)),
    villagesLost: sum(players, (player) => player.lostVillages),
    levelTotal: round(avg(alive, (player) => getEmpireLevel(player)), 2),
    regicideHeads: round(avg(alive, (player) => player.kingsKilled), 2),
    militaryRanking: round(avg(alive, (player) => player.militaryRanking), 2),
    influence: round(avg(alive, (player) => player.influence.total), 2),
    materials: round(avg(alive, (player) => player.resources.materials), 2),
    energy: round(avg(alive, (player) => player.resources.energy), 2),
    supplies: round(avg(alive, (player) => player.resources.supplies), 2),
    troopsAlive: round(sum(alive, (player) => player.troopsAlive)),
    troopsDeadPve: round(sum(players, (player) => player.troopsDeadPve)),
    troopsDeadPvp: round(sum(players, (player) => player.troopsDeadPvp)),
    eligiblePlayers: alive.filter((player) => player.influence.total >= PORTAL_CUT).length,
  };
}

function evaluateAllInDay(players, day) {
  const timeLeftMinutes = (WORLD.days - day + 1) * 24 * 60;
  let evaluated = 0;
  let reachable = 0;
  let etaMinutesTotal = 0;

  for (const player of players) {
    if (!player.alive || !player.kingAlive) continue;

    evaluated += 1;
    const distance = player.king.atPortal ? 0 : player.king.distanceToCenter;
    const etaMinutes = distance * estimateMoveMinutesToCenter(player, { applyPenalty: true });
    etaMinutesTotal += etaMinutes;
    if (etaMinutes <= timeLeftMinutes) reachable += 1;
  }

  const blocked = Math.max(0, evaluated - reachable);
  return {
    day,
    speedPenaltyMult: PHASE4_LOGISTICS_MULT,
    evaluated,
    reachable,
    blocked,
    reachRatePct: evaluated ? round((reachable / evaluated) * 100, 2) : 0,
    avgEtaHours: evaluated ? round((etaMinutesTotal / evaluated) / 60, 2) : 0,
  };
}

function runSimulation(seed, balance, options = {}) {
  const rng = mulberry32(seed);
  const players = [
    ...Array.from({ length: WORLD.humans }, (_, i) => createPlayer(i, true, rng, options)),
    ...Array.from({ length: WORLD.bots }, (_, i) => createPlayer(i, false, rng, options)),
  ];

  const totals = {
    expansions: 0,
    pvpBattles: 0,
    villagesTaken: 0,
    regicides: 0,
    wondersClaimed: 0,
    questsCompleted: 0,
    successions: 0,
    hordeStrikes: 0,
    gatheringInterceptions: 0,
    kingsKilledByHorde: 0,
    exodusAbandoned: 0,
    regroupOrders: 0,
    portalEntries: 0,
    portalBlocked: 0,
    worldCollapse: 0,
    troopsDeadPve: 0,
    troopsDeadPvp: 0,
  };

  const runState = { day90AvgInfluence: 0 };
  const dailyMetrics = [];
  const checkpoints = {};

  let day90ProfileEligible = null;
  let allInDay109 = null;

  updateMilitaryRanking(players);
  for (const player of players) {
    player.influence = calculateInfluence(player, 1);
    player.maxInfluenceObserved = Math.max(player.maxInfluenceObserved, player.influence.total);
  }

  for (let day = 1; day <= WORLD.days; day += 1) {
    for (const player of players) {
      if (!player.alive) continue;
      dailyProductionStep(player, balance);
      upgradeStep(player, day, balance);
      expansionStep(player, day, balance, rng, totals);
      heroStep(player, day, balance, rng);
      wonderStep(player, day, rng, totals);
      questStep(player, day, rng, totals);
      trainTroopsStep(player, day, balance);
    }

    updateMilitaryRanking(players);
    pvpStep(players, day, balance, rng, totals);
    updateMilitaryRanking(players);

    for (const player of players) {
      if (!player.alive) continue;
      successionRecoveryStep(player, day, rng, totals);
      exodusStep(player, day, rng, totals);
      issueRegroupOrder(player, day, options, rng, totals);
      marchStep(player);
    }

    hordeStep(players, day, balance, runState, rng, totals);
    updateMilitaryRanking(players);

    for (const player of players) {
      if (!player.alive) continue;
      refreshPhase4Bonuses(player, day);
      player.influence = calculateInfluence(player, day);
      player.maxInfluenceObserved = Math.max(player.maxInfluenceObserved, player.influence.total);
      resolvePortalStep(player, day, totals);
    }

    if (CHECKPOINT_DAYS.includes(day)) {
      for (const player of players) capturePlayerSnapshot(player, day);
      checkpoints[day] = captureCheckpoint(players, day);
    }

    if (day === 90) {
      day90ProfileEligible = countEligibleByProfile(players);
      runState.day90AvgInfluence = checkpoints[90]?.influence ?? 0;
    }

    if (day === ALL_IN_DAY) allInDay109 = evaluateAllInDay(players, day);

    dailyMetrics.push(captureDaily(players, day));

    if (day === 120) collapseDay120(players, totals);
  }

  const secondVillageDays = players.map((player) => player.milestones.secondVillageDay).filter((value) => typeof value === "number");
  const village100Days = players.map((player) => player.milestones.firstVillage100Day).filter((value) => typeof value === "number");

  const playerRecords = players.map((player) => {
    const day90 = player.snapshots[90] ?? null;
    const day120 = player.snapshots[120] ?? null;
    return {
      id: player.id,
      type: player.type,
      isHuman: player.isHuman,
      profileKey: player.profileKey,
      capitalStyle: player.capitalStyle,
      enteredPortal: player.enteredPortal,
      aliveAtEnd: player.alive,
      kingsKilled: player.kingsKilled,
      councilHeroes: player.councilHeroes,
      wondersControlled: player.wondersControlled,
      questComplete: player.questComplete,
      secondVillageDay: player.milestones.secondVillageDay,
      firstVillage100Day: player.milestones.firstVillage100Day,
      maxInfluenceObserved: player.maxInfluenceObserved,
      regroupIssued: player.king.regroupIssued,
      diedOnTrail: player.king.regroupIssued && !player.enteredPortal && !player.alive,
      startingTroops: player.startingTroops,
      troopsAliveDay120: day120?.troopsAlive ?? 0,
      troopRetentionPct: Math.max(0, (day90?.troopsAlive ?? player.startingTroops)) > 0
        ? round(((day120?.troopsAlive ?? 0) / Math.max(1, day90?.troopsAlive ?? player.startingTroops)) * 100, 2)
        : 0,
      troopsTrained: player.troopsTrained,
      lootFromRaids: player.lootFromRaids,
      spend: { ...player.spend },
      day90: day90 ?? {
        influenceTotal: 0,
        buildingInfluence: 0,
        councilInfluence: 0,
        militaryInfluence: 0,
        regicideInfluence: 0,
        wonderInfluence: 0,
        questInfluence: 0,
        domeInfluence: 0,
        conquestActiveInfluence: 0,
        villagesActive: 0,
        levelTotal: 0,
        councilHeroes: 0,
        materials: 0,
        energy: 0,
        supplies: 0,
        troopsAlive: 0,
        roads: 0,
        distanceToCenter: 0,
      },
      day120: day120 ?? {
        influenceTotal: 0,
        buildingInfluence: 0,
        councilInfluence: 0,
        militaryInfluence: 0,
        regicideInfluence: 0,
        wonderInfluence: 0,
        questInfluence: 0,
        domeInfluence: 0,
        conquestActiveInfluence: 0,
        villagesActive: 0,
        levelTotal: 0,
        councilHeroes: 0,
        materials: 0,
        energy: 0,
        supplies: 0,
        troopsAlive: 0,
        roads: 0,
        distanceToCenter: 0,
      },
    };
  });

  return {
    seed,
    scenarioId: options.scenarioId ?? null,
    capitalStyle: options.capitalStyle ?? null,
    day90Eligible: checkpoints[90]?.eligiblePlayers ?? 0,
    portalSurvivors: players.filter((player) => player.enteredPortal).length,
    aliveAtEnd: players.filter((player) => player.alive).length,
    humansAliveAtEnd: players.filter((player) => player.alive && player.isHuman).length,
    maxInfluenceObserved: Math.max(...players.map((player) => player.maxInfluenceObserved)),
    milestones: {
      firstSecondVillageDay: secondVillageDays.length ? Math.min(...secondVillageDays) : null,
      avgSecondVillageDay: secondVillageDays.length ? round(avg(secondVillageDays), 2) : null,
      firstVillage100Day: village100Days.length ? Math.min(...village100Days) : null,
      avgVillage100Day: village100Days.length ? round(avg(village100Days), 2) : null,
    },
    profileEligibleDay90: day90ProfileEligible ?? countEligibleByProfile(players),
    allInDay109,
    totals,
    checkpoints,
    dailyMetrics,
    playerRecords,
  };
}

function runBatch(balance, options = {}) {
  return WORLD_SEED_SCENARIOS.map((scenario) => runSimulation(scenario.seed, balance, { ...options, scenarioId: scenario.id, capitalStyle: scenario.capitalStyle }));
}
function gatherRecords(runs) {
  return runs.flatMap((run) => run.playerRecords);
}

function aggregateCheckpoints(runs) {
  const output = {};

  for (const day of CHECKPOINT_DAYS) {
    const points = runs.map((run) => run.checkpoints[day]).filter(Boolean);
    output[day] = {
      day,
      alivePlayers: round(avg(points, (point) => point.alivePlayers), 2),
      villagesActive: round(avg(points, (point) => point.villagesActive), 2),
      villagesLost: round(avg(points, (point) => point.villagesLost), 2),
      levelTotal: round(avg(points, (point) => point.levelTotal), 2),
      regicideHeads: round(avg(points, (point) => point.regicideHeads), 2),
      militaryRanking: round(avg(points, (point) => point.militaryRanking), 2),
      influence: round(avg(points, (point) => point.influence), 2),
      materials: round(avg(points, (point) => point.materials), 2),
      energy: round(avg(points, (point) => point.energy), 2),
      supplies: round(avg(points, (point) => point.supplies), 2),
      troopsAlive: round(avg(points, (point) => point.troopsAlive), 2),
      troopsDeadPve: round(avg(points, (point) => point.troopsDeadPve), 2),
      troopsDeadPvp: round(avg(points, (point) => point.troopsDeadPvp), 2),
      eligiblePlayers: round(avg(points, (point) => point.eligiblePlayers), 2),
    };
  }

  return output;
}

function aggregateDaily(runs) {
  return Array.from({ length: WORLD.days }, (_, index) => {
    const day = index + 1;
    const points = runs.map((run) => run.dailyMetrics.find((metric) => metric.day === day)).filter(Boolean);

    return {
      day,
      alivePlayers: round(avg(points, (point) => point.alivePlayers), 2),
      villagesActive: round(avg(points, (point) => point.villagesActive), 2),
      avgLevelTotal: round(avg(points, (point) => point.avgLevelTotal), 2),
      avgMilitaryRanking: round(avg(points, (point) => point.avgMilitaryRanking), 2),
      avgInfluence: round(avg(points, (point) => point.avgInfluence), 2),
      eligiblePlayers: round(avg(points, (point) => point.eligiblePlayers), 2),
    };
  });
}

function aggregatePhaseWindows(dailyAverages) {
  return PHASE_WINDOWS.map((window) => {
    const points = dailyAverages.filter((point) => point.day >= window.start && point.day <= window.end);
    return {
      phase: window.name,
      startDay: window.start,
      endDay: window.end,
      avgAlivePlayers: round(avg(points, (point) => point.alivePlayers), 2),
      avgVillagesActive: round(avg(points, (point) => point.villagesActive), 2),
      avgLevelTotal: round(avg(points, (point) => point.avgLevelTotal), 2),
      avgInfluence: round(avg(points, (point) => point.avgInfluence), 2),
      avgEligiblePlayers: round(avg(points, (point) => point.eligiblePlayers), 2),
    };
  });
}

function aggregateAllIn(runs) {
  const allInPoints = runs.map((run) => run.allInDay109).filter(Boolean);
  const evaluated = sum(allInPoints, (point) => point.evaluated);
  const reachable = sum(allInPoints, (point) => point.reachable);
  const blocked = sum(allInPoints, (point) => point.blocked);

  return {
    day: ALL_IN_DAY,
    speedPenaltyMult: PHASE4_LOGISTICS_MULT,
    evaluated,
    reachable,
    blocked,
    reachRatePct: evaluated ? round((reachable / evaluated) * 100, 2) : 0,
    avgEtaHours: round(avg(allInPoints, (point) => point.avgEtaHours), 2),
    conclusion: reachable > 0
      ? "Existe janela fisica para tocar o centro antes do Dia 120, mas depende de carga e distancia."
      : "Nao ha janela fisica para tocar o centro antes do Dia 120 no all-in Dia 109.",
  };
}

function aggregateProfileEligibility(runs) {
  const output = {};
  for (const key of PROFILE_KEYS) output[key] = round(avg(runs, (run) => run.profileEligibleDay90?.[key] ?? 0), 2);
  return output;
}

function aggregateMilestones(runs) {
  const secondDays = runs.map((run) => run.milestones.firstSecondVillageDay).filter((value) => typeof value === "number");
  const secondAvg = runs.map((run) => run.milestones.avgSecondVillageDay).filter((value) => typeof value === "number");
  const lvl100Days = runs.map((run) => run.milestones.firstVillage100Day).filter((value) => typeof value === "number");
  const lvl100Avg = runs.map((run) => run.milestones.avgVillage100Day).filter((value) => typeof value === "number");

  return {
    firstSecondVillageDay: secondDays.length ? Math.min(...secondDays) : null,
    avgSecondVillageDay: secondAvg.length ? round(avg(secondAvg), 2) : null,
    firstVillage100Day: lvl100Days.length ? Math.min(...lvl100Days) : null,
    avgVillage100Day: lvl100Avg.length ? round(avg(lvl100Avg), 2) : null,
  };
}

function pearsonCorrelation(values, outcomes) {
  if (!values.length || values.length !== outcomes.length) return 0;

  const meanX = avg(values);
  const meanY = avg(outcomes);

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (let i = 0; i < values.length; i += 1) {
    const dx = values[i] - meanX;
    const dy = outcomes[i] - meanY;
    num += dx * dy;
    denX += dx ** 2;
    denY += dy ** 2;
  }

  if (denX <= 0 || denY <= 0) return 0;
  return num / Math.sqrt(denX * denY);
}

function summarizeVariableImpact(records, variableKey) {
  const values = records.map((record) => readPath(record, variableKey));
  const outcomes = records.map((record) => (record.enteredPortal ? 1 : 0));

  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;

  const high = records.filter((record) => readPath(record, variableKey) >= median);
  const low = records.filter((record) => readPath(record, variableKey) < median);

  const highRate = high.length ? avg(high, (record) => (record.enteredPortal ? 1 : 0)) : 0;
  const lowRate = low.length ? avg(low, (record) => (record.enteredPortal ? 1 : 0)) : 0;

  return {
    correlation: round(pearsonCorrelation(values, outcomes), 4),
    highRate: round(highRate, 4),
    lowRate: round(lowRate, 4),
    deltaRate: round(highRate - lowRate, 4),
    median: round(median, 2),
  };
}

function buildProfileComparative(records) {
  const out = [];

  for (const profileKey of PROFILE_KEYS) {
    const items = records.filter((record) => record.profileKey === profileKey);
    const entered = items.filter((record) => record.enteredPortal);

    const secondVillageDays = items.map((record) => record.secondVillageDay).filter((value) => typeof value === "number");
    const first100Days = items.map((record) => record.firstVillage100Day).filter((value) => typeof value === "number");

    out.push({
      profileKey,
      label: PROFILE_DEFS[profileKey].label,
      sample: items.length,
      portalEntryRatePct: round((entered.length / Math.max(1, items.length)) * 100, 2),
      day90Influence: round(avg(items, (record) => record.day90.influenceTotal), 2),
      day90Building: round(avg(items, (record) => record.day90.buildingInfluence), 2),
      day90Council: round(avg(items, (record) => record.day90.councilInfluence), 2),
      day90Military: round(avg(items, (record) => record.day90.militaryInfluence), 2),
      day90Regicide: round(avg(items, (record) => record.day90.regicideInfluence), 2),
      day90Villages: round(avg(items, (record) => record.day90.villagesActive), 2),
      day120TroopRetentionPct: round(avg(items, (record) => record.troopRetentionPct), 2),
      avgKingsKilled: round(avg(items, (record) => record.kingsKilled), 2),
      avgCouncilHeroes: round(avg(items, (record) => record.councilHeroes), 2),
      avgLoot: round(avg(items, (record) => record.lootFromRaids), 2),
      firstSecondVillageDay: secondVillageDays.length ? Math.min(...secondVillageDays) : null,
      avgSecondVillageDay: secondVillageDays.length ? round(avg(secondVillageDays), 2) : null,
      firstVillage100Day: first100Days.length ? Math.min(...first100Days) : null,
      avgFirstVillage100Day: first100Days.length ? round(avg(first100Days), 2) : null,
    });
  }

  return out;
}

function buildStyleSummary(runs, records) {
  const rows = [];

  for (const style of PROFILE_KEYS) {
    const styleRuns = runs.filter((run) => run.capitalStyle === style);
    const styleRecords = records.filter((record) => record.capitalStyle === style);

    const secondDays = styleRecords.map((record) => record.secondVillageDay).filter((value) => typeof value === "number");
    const first100Days = styleRecords.map((record) => record.firstVillage100Day).filter((value) => typeof value === "number");

    rows.push({
      styleKey: style,
      label: PROFILE_DEFS[style].label,
      seeds: styleRuns.length,
      samplePlayers: styleRecords.length,
      avgFinalAlive: round(avg(styleRuns, (run) => run.aliveAtEnd), 2),
      avgPortalEntries: round(avg(styleRuns, (run) => run.portalSurvivors), 2),
      avgPortalEntryRatePct: round(avg(styleRuns, (run) => (run.portalSurvivors / WORLD.players) * 100), 2),
      avgPortal2500: round(avg(styleRuns, (run) => run.playerRecords.filter((record) => record.enteredPortal && record.maxInfluenceObserved >= INFLUENCE_CAP).length), 2),
      avgReached2500: round(avg(styleRuns, (run) => run.playerRecords.filter((record) => record.maxInfluenceObserved >= INFLUENCE_CAP).length), 2),
      avgDiedOnTrail: round(avg(styleRuns, (run) => run.playerRecords.filter((record) => record.diedOnTrail).length), 2),
      avgInfluenceD15: round(avg(styleRuns, (run) => run.checkpoints[15]?.influence ?? 0), 2),
      avgInfluenceD30: round(avg(styleRuns, (run) => run.checkpoints[30]?.influence ?? 0), 2),
      avgInfluenceD60: round(avg(styleRuns, (run) => run.checkpoints[60]?.influence ?? 0), 2),
      avgInfluenceD90: round(avg(styleRuns, (run) => run.checkpoints[90]?.influence ?? 0), 2),
      avgInfluenceD120: round(avg(styleRuns, (run) => run.checkpoints[120]?.influence ?? 0), 2),
      avgVillagesD90: round(avg(styleRuns, (run) => run.checkpoints[90]?.villagesActive ?? 0), 2),
      avgVillagesD120: round(avg(styleRuns, (run) => run.checkpoints[120]?.villagesActive ?? 0), 2),
      avgSecondVillageDay: secondDays.length ? round(avg(secondDays), 2) : null,
      avgFirstVillage100Day: first100Days.length ? round(avg(first100Days), 2) : null,
      avgMaxInfluence: round(avg(styleRecords, (record) => record.maxInfluenceObserved), 2),
    });
  }

  return rows;
}

function computeTargetLockMetrics(runs, records, styleSummary) {
  const secondDays = records.map((record) => record.secondVillageDay).filter((value) => typeof value === "number");
  const first100Days = records.map((record) => record.firstVillage100Day).filter((value) => typeof value === "number");

  const avgFirstConquestDay = secondDays.length ? avg(secondDays) : 999;
  const avgFirstVillage100Day = first100Days.length ? avg(first100Days) : 999;

  const portal2500PerRun = runs.map((run) => run.playerRecords.filter((record) => record.enteredPortal && record.maxInfluenceObserved >= INFLUENCE_CAP).length);
  const reached2500PerRun = runs.map((run) => run.playerRecords.filter((record) => record.maxInfluenceObserved >= INFLUENCE_CAP).length);

  const entered2200to2399PerRun = runs.map((run) => run.playerRecords.filter((record) => record.enteredPortal && record.maxInfluenceObserved >= 2200 && record.maxInfluenceObserved < 2400).length);
  const entered2400to2499PerRun = runs.map((run) => run.playerRecords.filter((record) => record.enteredPortal && record.maxInfluenceObserved >= 2400 && record.maxInfluenceObserved < 2500).length);
  const diedOnTrailPerRun = runs.map((run) => run.playerRecords.filter((record) => record.diedOnTrail).length);

  const metropole = styleSummary.find((row) => row.styleKey === "metropole") ?? null;
  const posto = styleSummary.find((row) => row.styleKey === "posto") ?? null;

  const stylePortalDeltaPct = metropole && posto ? Math.abs(metropole.avgPortalEntryRatePct - posto.avgPortalEntryRatePct) : 999;
  const styleVillageDeltaD90 = metropole && posto ? Math.abs(metropole.avgVillagesD90 - posto.avgVillagesD90) : 999;

  const avgPortal2500Entrants = avg(portal2500PerRun);
  const avgReached2500 = avg(reached2500PerRun);
  const avgEntered2200to2399 = avg(entered2200to2399PerRun);
  const avgEntered2400to2499 = avg(entered2400to2499PerRun);
  const avgDiedOnTrail = avg(diedOnTrailPerRun);

  const targetHit =
    avgFirstConquestDay >= 14
    && avgFirstConquestDay <= 16.5
    && avgFirstVillage100Day >= 43
    && avgFirstVillage100Day <= 47
    && avgPortal2500Entrants >= 13
    && avgPortal2500Entrants <= 17
    && stylePortalDeltaPct <= TARGET_STYLE_PARITY_DELTA
    && styleVillageDeltaD90 <= 45
    && avgEntered2200to2399 >= 1
    && avgEntered2400to2499 >= 1
    && avgDiedOnTrail >= 1;

  return {
    avgFirstConquestDay: round(avgFirstConquestDay, 2),
    avgFirstVillage100Day: round(avgFirstVillage100Day, 2),
    avgPortal2500Entrants: round(avgPortal2500Entrants, 2),
    avgReached2500: round(avgReached2500, 2),
    avgEntered2200to2399: round(avgEntered2200to2399, 2),
    avgEntered2400to2499: round(avgEntered2400to2499, 2),
    avgDiedOnTrail: round(avgDiedOnTrail, 2),
    stylePortalDeltaPct: round(stylePortalDeltaPct, 2),
    styleVillageDeltaD90: round(styleVillageDeltaD90, 2),
    targetHit,
  };
}

function buildSensitivityAudit(records, checkpoints) {
  const variables = [
    { key: "day90.buildingInfluence", label: "Edificios", category: "Edificios" },
    { key: "day90.militaryInfluence", label: "Tropas", category: "Tropas" },
    { key: "day90.councilInfluence", label: "Herois", category: "Herois" },
    { key: "day90.distanceToCenter", label: "Localizacao", category: "Localizacao", invert: true },
    { key: "day90.regicideInfluence", label: "Regicida", category: "Tropas" },
    { key: "day90.roads", label: "Malha Viaria", category: "Localizacao" },
  ];

  const impacts = variables.map((variable) => {
    const raw = summarizeVariableImpact(records, variable.key);
    const correlation = variable.invert ? raw.correlation * -1 : raw.correlation;
    const deltaRate = variable.invert ? raw.deltaRate * -1 : raw.deltaRate;

    return {
      ...variable,
      correlation: round(correlation, 4),
      deltaRate: round(deltaRate, 4),
      highRate: raw.highRate,
      lowRate: raw.lowRate,
      median: raw.median,
    };
  });

  const categoryTable = ["Edificios", "Tropas", "Herois", "Localizacao"].map((category) => {
    const items = impacts.filter((impact) => impact.category === category);
    return {
      title: category,
      correlationWithVictory: round(avg(items, (item) => item.correlation), 4),
      successDelta: round(avg(items, (item) => item.deltaRate), 4),
    };
  });

  const impactZero = impacts
    .filter((impact) => Math.abs(impact.correlation) < 0.05 || Math.abs(impact.deltaRate) < 0.03)
    .map((impact) => ({
      variable: impact.label,
      note: `Impacto baixo (corr=${impact.correlation}, delta=${round(impact.deltaRate * 100, 2)}pp).`,
    }));

  const spendSignals = [
    { key: "spend.upgrades", label: "Upgrade de Predios", influenceKey: "day90.buildingInfluence" },
    { key: "spend.heroes", label: "Conselho de Herois", influenceKey: "day90.councilInfluence" },
    { key: "spend.troops", label: "Recrutamento", influenceKey: "day90.militaryInfluence" },
    { key: "spend.raids", label: "Operacoes de Ataque", influenceKey: "day90.regicideInfluence" },
  ];

  const costImbalance = spendSignals
    .map((signal) => {
      const spend = records.map((record) => readPath(record, signal.key));
      const influence = records.map((record) => readPath(record, signal.influenceKey));
      const outcomes = records.map((record) => (record.enteredPortal ? 1 : 0));

      const spendAvg = avg(spend);
      const influenceAvg = avg(influence);
      const corr = pearsonCorrelation(spend, outcomes);
      const roi = influenceAvg > 0 ? spendAvg / influenceAvg : Number.POSITIVE_INFINITY;

      return {
        label: signal.label,
        spendAvg: round(spendAvg, 2),
        influenceAvg: round(influenceAvg, 2),
        outcomeCorr: round(corr, 4),
        spendPerInfluence: Number.isFinite(roi) ? round(roi, 2) : null,
      };
    })
    .filter((item) => item.outcomeCorr < 0.08 && (item.spendPerInfluence ?? 0) > 25)
    .map((item) => ({
      variable: item.label,
      note: `Custo alto com retorno fraco (corr=${item.outcomeCorr}, custo/ponto=${item.spendPerInfluence}).`,
    }));

  const entrants = records.filter((record) => record.enteredPortal);
  const blocked = records.filter((record) => !record.enteredPortal);

  const influenceGaps = [
    { key: "day90.buildingInfluence", label: "Edificios" },
    { key: "day90.councilInfluence", label: "Herois" },
    { key: "day90.militaryInfluence", label: "Militar" },
    { key: "day90.regicideInfluence", label: "Regicida" },
  ].map((item) => ({
    ...item,
    gap: round(avg(entrants, (record) => readPath(record, item.key)) - avg(blocked, (record) => readPath(record, item.key)), 2),
  }));

  const bottleneck = influenceGaps.sort((a, b) => b.gap - a.gap)[0] ?? { label: "N/A", gap: 0 };

  const d90Influence = checkpoints[90]?.influence ?? 0;
  const suggestions = [];

  if (d90Influence < TARGET_DAY90_INFLUENCE) {
    suggestions.push("Aumentar ganho de conselho no mid game ou reduzir custo de herois no tier 3.");
  }

  const regicideImpact = impacts.find((impact) => impact.key === "day90.regicideInfluence");
  if ((regicideImpact?.correlation ?? 0) < 0.08) {
    suggestions.push("Regicida ainda baixo: reduzir custo de raid em mais 10% para Posto Avancado ou subir chance de kill.");
  }

  const buildingImpact = impacts.find((impact) => impact.key === "day90.buildingInfluence");
  if ((buildingImpact?.correlation ?? 0) > 0.45) {
    suggestions.push("Predios estao dominando a corrida: buffar militar/conselho em +5% no Dia 61-90 para variedade de builds.");
  }

  return {
    impacts,
    categoryTable,
    impactZero,
    costImbalance,
    bottleneck,
    suggestions,
  };
}

function evaluateCalibration(runs) {
  const records = gatherRecords(runs);
  const styleSummary = buildStyleSummary(runs, records);
  const lock = computeTargetLockMetrics(runs, records, styleSummary);

  const score =
    Math.abs(lock.avgFirstConquestDay - TARGET_FIRST_CONQUEST_DAY) * 2.1
    + Math.abs(lock.avgFirstVillage100Day - TARGET_FIRST_V100_DAY) * 1.7
    + Math.abs(lock.avgPortal2500Entrants - TARGET_PORTAL_2500_ENTRANTS) * 2.3
    + Math.max(0, lock.stylePortalDeltaPct - TARGET_STYLE_PARITY_DELTA) * 1.5
    + Math.max(0, lock.styleVillageDeltaD90 - 45) * 0.08
    + (lock.avgEntered2200to2399 < 1 ? 4 : 0)
    + (lock.avgEntered2400to2499 < 1 ? 4 : 0)
    + (lock.avgDiedOnTrail < 1 ? 4 : 0);

  return {
    ...lock,
    score: round(score, 4),
    targetHit: lock.targetHit,
  };
}

function calibrateBalance() {
  let balance = { ...INITIAL_BALANCE };
  let runs = runBatch(balance);
  let metrics = evaluateCalibration(runs);

  const history = [];

  let bestRuns = runs;
  let bestBalance = { ...balance };
  let bestMetrics = { ...metrics };

  for (let iteration = 1; iteration <= 20; iteration += 1) {
    history.push({ iteration, ...balance, ...metrics });

    if (metrics.score < bestMetrics.score) {
      bestRuns = runs;
      bestBalance = { ...balance };
      bestMetrics = { ...metrics };
    }

    if (metrics.targetHit) {
      return { balance, runs, history, metrics, targetHit: true };
    }

    const tooHard =
      metrics.avgFirstConquestDay > 16.5
      || metrics.avgFirstVillage100Day > 47
      || metrics.avgPortal2500Entrants < 13;

    const tooEasy =
      metrics.avgFirstConquestDay < 14
      || metrics.avgFirstVillage100Day < 43
      || metrics.avgPortal2500Entrants > 17;

    if (tooHard) {
      balance = {
        productionMult: round(Math.min(1.5, balance.productionMult * 1.03), 4),
        upgradeCostMult: round(Math.max(0.5, balance.upgradeCostMult * 0.95), 4),
        expansionCostMult: round(Math.max(0.5, balance.expansionCostMult * 0.95), 4),
        trainingCostMult: round(Math.max(0.7, balance.trainingCostMult * 0.97), 4),
        attackCostMult: round(Math.max(0.5, balance.attackCostMult * 0.96), 4),
        heroCostMult: round(Math.max(0.6, balance.heroCostMult * 0.95), 4),
        hordeLethality: round(Math.max(0.72, balance.hordeLethality * 0.985), 4),
        peripheryHordeMult: round(Math.max(0.92, balance.peripheryHordeMult * 0.985), 4),
        bastionWallBuff: round(Math.min(1.95, balance.bastionWallBuff * 1.02), 4),
        buildActionMult: round(Math.min(1.35, balance.buildActionMult * 1.03), 4),
      };
    } else if (tooEasy) {
      balance = {
        productionMult: round(Math.max(0.62, balance.productionMult * 0.975), 4),
        upgradeCostMult: round(Math.min(2.05, balance.upgradeCostMult * 1.04), 4),
        expansionCostMult: round(Math.min(2.05, balance.expansionCostMult * 1.04), 4),
        trainingCostMult: round(Math.min(1.85, balance.trainingCostMult * 1.03), 4),
        attackCostMult: round(Math.min(1.45, balance.attackCostMult * 1.03), 4),
        heroCostMult: round(Math.min(1.65, balance.heroCostMult * 1.03), 4),
        hordeLethality: round(Math.min(1.55, balance.hordeLethality * 1.015), 4),
        peripheryHordeMult: round(Math.min(2.1, balance.peripheryHordeMult * 1.03), 4),
        bastionWallBuff: round(Math.max(1.0, balance.bastionWallBuff * 0.99), 4),
        buildActionMult: round(Math.max(0.5, balance.buildActionMult * 0.97), 4),
      };
    }

    if (metrics.stylePortalDeltaPct > TARGET_STYLE_PARITY_DELTA) {
      balance.attackCostMult = round(Math.min(1.5, balance.attackCostMult * 1.01), 4);
      balance.heroCostMult = round(Math.max(0.55, balance.heroCostMult * 0.99), 4);
    }

    if (metrics.avgDiedOnTrail < 1) {
      balance.hordeLethality = round(Math.min(1.6, balance.hordeLethality * 1.02), 4);
    }

    if (metrics.avgPortal2500Entrants > 17) {
      balance.hordeLethality = round(Math.min(1.65, balance.hordeLethality * 1.03), 4);
      balance.trainingCostMult = round(Math.min(1.95, balance.trainingCostMult * 1.02), 4);
    }

    runs = runBatch(balance);
    metrics = evaluateCalibration(runs);
  }

  return {
    balance: bestBalance,
    runs: bestRuns,
    history,
    metrics: bestMetrics,
    targetHit: false,
  };
}

function buildSummary(runs) {
  const checkpoints = aggregateCheckpoints(runs);
  const dailyAverages = aggregateDaily(runs);
  const records = gatherRecords(runs);
  const styleSummary = buildStyleSummary(runs, records);
  const targetLocks = computeTargetLockMetrics(runs, records, styleSummary);

  const influenceBands = {
    avgEntered2200to2399: round(avg(runs, (run) => run.playerRecords.filter((record) => record.enteredPortal && record.maxInfluenceObserved >= 2200 && record.maxInfluenceObserved < 2400).length), 2),
    avgEntered2400to2499: round(avg(runs, (run) => run.playerRecords.filter((record) => record.enteredPortal && record.maxInfluenceObserved >= 2400 && record.maxInfluenceObserved < 2500).length), 2),
    avgEntered2500: round(avg(runs, (run) => run.playerRecords.filter((record) => record.enteredPortal && record.maxInfluenceObserved >= INFLUENCE_CAP).length), 2),
    avgDiedOnTrail2200plus: round(avg(runs, (run) => run.playerRecords.filter((record) => record.diedOnTrail && record.maxInfluenceObserved >= 2200).length), 2),
  };

  return {
    table: runs.map((run) => ({
      seed: run.seed,
      scenarioId: run.scenarioId,
      capitalStyle: run.capitalStyle,
      day90Eligible: run.day90Eligible,
      portalSurvivors: run.portalSurvivors,
      aliveAtEnd: run.aliveAtEnd,
      humansAliveAtEnd: run.humansAliveAtEnd,
      firstSecondVillageDay: run.milestones.firstSecondVillageDay,
      firstVillage100Day: run.milestones.firstVillage100Day,
      maxInfluenceObserved: run.maxInfluenceObserved,
    })),
    averages: {
      day90Eligible: round(avg(runs, (run) => run.day90Eligible), 2),
      portalSurvivors: round(avg(runs, (run) => run.portalSurvivors), 2),
      aliveAtEnd: round(avg(runs, (run) => run.aliveAtEnd), 2),
      humansAliveAtEnd: round(avg(runs, (run) => run.humansAliveAtEnd), 2),
      targetHit10to15: avg(runs, (run) => run.day90Eligible) >= 10 && avg(runs, (run) => run.day90Eligible) <= 15,
    },
    checkpoints,
    dailyAverages,
    phaseWindows: aggregatePhaseWindows(dailyAverages),
    profileEligibleDay90: aggregateProfileEligibility(runs),
    milestones: aggregateMilestones(runs),
    profileComparative: buildProfileComparative(records),
    styleSummary,
    targetLocks,
    influenceBands,
    worldTotals: {
      expansions: round(avg(runs, (run) => run.totals.expansions), 2),
      pvpBattles: round(avg(runs, (run) => run.totals.pvpBattles), 2),
      regicides: round(avg(runs, (run) => run.totals.regicides), 2),
      successions: round(avg(runs, (run) => run.totals.successions), 2),
      exodusAbandoned: round(avg(runs, (run) => run.totals.exodusAbandoned), 2),
      regroupOrders: round(avg(runs, (run) => run.totals.regroupOrders), 2),
      portalEntries: round(avg(runs, (run) => run.totals.portalEntries), 2),
      portalBlocked: round(avg(runs, (run) => run.totals.portalBlocked), 2),
      gatheringInterceptions: round(avg(runs, (run) => run.totals.gatheringInterceptions), 2),
      troopsDeadPve: round(avg(runs, (run) => run.totals.troopsDeadPve), 2),
      troopsDeadPvp: round(avg(runs, (run) => run.totals.troopsDeadPvp), 2),
      wondersClaimed: round(avg(runs, (run) => run.totals.wondersClaimed), 2),
      questsCompleted: round(avg(runs, (run) => run.totals.questsCompleted), 2),
      regicideCap300Players: round(avg(runs, (run) => run.playerRecords.filter((record) => record.kingsKilled >= 3).length), 2),
      wonderCapPlayers: round(avg(runs, (run) => run.playerRecords.filter((record) => record.wondersControlled >= 4).length), 2),
      totalRegicideCap300Players: records.filter((record) => record.kingsKilled >= 3).length,
      totalWonderCapPlayers: records.filter((record) => record.wondersControlled >= 4).length,
      totalQuestCompletePlayers: records.filter((record) => record.questComplete).length,
      recordsEvaluated: records.length,
    },
    sanity: {
      maxInfluenceObserved: Math.max(...runs.map((run) => run.maxInfluenceObserved)),
      influenceCap: INFLUENCE_CAP,
      records: records.length,
    },
  };
}

function toCsv(rows, headers) {
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => row[header]).join(",")).join("\n")}\n`;
}

function buildReport(results) {
  const checkpoints = results.baseline.checkpoints;
  const rows = [15, 30, 60, 90, 120].map((day) => checkpoints[String(day)] ?? checkpoints[day]);
  const styleRows = results.baseline.styleSummary ?? [];
  const lock = results.baseline.targetLocks;
  const worldTotals = results.baseline.worldTotals;
  const bands = results.baseline.influenceBands;

  const metricRow = (label, key, digits = 1) => {
    const values = rows.map((row) => (row ? round(row[key], digits) : "-"));
    return `| ${label} | ${values[0]} | ${values[1]} | ${values[2]} | ${values[3]} | ${values[4]} |`;
  };

  const okFlag = (state) => (state ? "OK" : "AJUSTAR");
  const lockConquest = lock.avgFirstConquestDay >= 14 && lock.avgFirstConquestDay <= 16.5;
  const lockVillage100 = lock.avgFirstVillage100Day >= 43 && lock.avgFirstVillage100Day <= 47;
  const lockPortal2500 = lock.avgPortal2500Entrants >= 13 && lock.avgPortal2500Entrants <= 17;
  const lockStyleParity = lock.stylePortalDeltaPct <= TARGET_STYLE_PARITY_DELTA;
  const lockVariation = lock.avgEntered2200to2399 >= 1 && lock.avgEntered2400to2499 >= 1 && lock.avgDiedOnTrail >= 1;

  const lines = [];

  lines.push("# KingsWorld - Relatorio V3 (Builds, Travas e Sensibilidade)");
  lines.push("");
  lines.push("## Regras aplicadas neste ciclo");
  lines.push("");
  lines.push(`- Influencia de Predios: 1 nivel = 1 ponto (10 aldeias nivel 100 = 1000).`);
  lines.push(`- Regicida: +${REGICIDE_POINTS} por Rei (cap ${REGICIDE_CAP * REGICIDE_POINTS}).`);
  lines.push("- Maravilhas: 4 slots x 50 (cap 200). Quest de Soberania: +100.");
  lines.push("- Conselho limitado a 400, Militar 200, Rei 200, Domo/Tribo 100, Conquistas Ativas cap 600.");
  lines.push(`- Corte do Portal: ${PORTAL_CUT}. Cap de Influencia: ${INFLUENCE_CAP}.`);
  lines.push(`- Mobilizacao Fase IV: x${PHASE4_LOGISTICS_MULT}; Interceptacao Horda: x${HORDES_INTERCEPT_MULT}.`);
  lines.push("");

  lines.push("## Painel de Travas Alvo");
  lines.push("");
  lines.push(`- 2a aldeia media perto do Dia 15: ${lock.avgFirstConquestDay} (${okFlag(lockConquest)}).`);
  lines.push(`- 1a aldeia nivel 100 media perto do Dia 45: ${lock.avgFirstVillage100Day} (${okFlag(lockVillage100)}).`);
  lines.push(`- Players 2500 + portal por seed (alvo ~15): ${lock.avgPortal2500Entrants} (${okFlag(lockPortal2500)}).`);
  lines.push(`- Paridade de estilo (delta portal <= ${TARGET_STYLE_PARITY_DELTA}%): ${lock.stylePortalDeltaPct}% (${okFlag(lockStyleParity)}).`);
  lines.push(`- Variacao de outcome (2200/2400/morte na trilha): ${okFlag(lockVariation)}.`);
  lines.push(`- Players que chegaram a 2500 por seed: ${lock.avgReached2500}.`);
  lines.push("");

  lines.push("## Progressao temporal (Dias 15, 30, 60, 90, 120)");
  lines.push("");
  lines.push("| Metrica | D15 | D30 | D60 | D90 | D120 |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: |");
  lines.push(metricRow("Vilas Ativas", "villagesActive", 2));
  lines.push(metricRow("Nivel Total", "levelTotal", 2));
  lines.push(metricRow("Influencia", "influence", 2));
  lines.push(metricRow("Materiais", "materials", 0));
  lines.push(metricRow("Energia", "energy", 0));
  lines.push(metricRow("Suprimentos", "supplies", 0));
  lines.push(metricRow("Ranking Militar", "militaryRanking", 2));
  lines.push(metricRow("Regicida (cabecas)", "regicideHeads", 2));
  lines.push(metricRow("Tropas Vivas", "troopsAlive", 0));
  lines.push(metricRow("Players >= 1500", "eligiblePlayers", 2));
  lines.push("");

  lines.push("## Resultado por estilo base da Capital (5 seeds por estilo)");
  lines.push("");
  lines.push("| Estilo | Seeds | Amostra | Sobreviventes finais/seed | Entradas portal/seed | Entradas 2500/seed | Players 2500/seed | Mortos na trilha/seed | 2a aldeia media | 1a aldeia 100 media |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");

  for (const row of styleRows) {
    lines.push(`| ${row.label} | ${row.seeds} | ${row.samplePlayers} | ${row.avgFinalAlive} | ${row.avgPortalEntries} | ${row.avgPortal2500} | ${row.avgReached2500} | ${row.avgDiedOnTrail} | ${row.avgSecondVillageDay ?? "-"} | ${row.avgFirstVillage100Day ?? "-"} |`);
  }

  lines.push("");
  lines.push("## Influencia media por estilo (para comparar builds)");
  lines.push("");
  lines.push("| Estilo | D15 | D30 | D60 | D90 | D120 | Pico medio |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const row of styleRows) {
    lines.push(`| ${row.label} | ${row.avgInfluenceD15} | ${row.avgInfluenceD30} | ${row.avgInfluenceD60} | ${row.avgInfluenceD90} | ${row.avgInfluenceD120} | ${row.avgMaxInfluence} |`);
  }

  lines.push("");
  lines.push("## Conquistas ativas (Regicida, Maravilhas, Quest)");
  lines.push("");
  lines.push(`- Regicida cap (300) medio por seed: ${worldTotals.regicideCap300Players}.`);
  lines.push(`- Regicida cap (300) total em ${results.metadata.seeds.length} seeds: ${worldTotals.totalRegicideCap300Players}/${worldTotals.recordsEvaluated} players.`);
  lines.push(`- 4 Maravilhas medio por seed: ${worldTotals.wonderCapPlayers}.`);
  lines.push(`- 4 Maravilhas total em ${results.metadata.seeds.length} seeds: ${worldTotals.totalWonderCapPlayers}/${worldTotals.recordsEvaluated} players.`);
  lines.push(`- Quest completa total: ${worldTotals.totalQuestCompletePlayers}/${worldTotals.recordsEvaluated} players.`);
  lines.push(`- Maravilhas dominadas por seed: ${worldTotals.wondersClaimed}.`);
  lines.push(`- Quests completas por seed: ${worldTotals.questsCompleted}.`);
  lines.push("");

  lines.push("## Distribuicao de outcome no Portal");
  lines.push("");
  lines.push(`- Entraram entre 2200-2399: ${bands.avgEntered2200to2399} por seed.`);
  lines.push(`- Entraram entre 2400-2499: ${bands.avgEntered2400to2499} por seed.`);
  lines.push(`- Entraram em 2500: ${bands.avgEntered2500} por seed.`);
  lines.push(`- Morreram na trilha com 2200+: ${bands.avgDiedOnTrail2200plus} por seed.`);
  lines.push("");

  lines.push("## Correlacao por titulo x Vitoria (Portal)");
  lines.push("");
  lines.push("| Titulo | Correlacao | Delta de Sucesso |");
  lines.push("| --- | ---: | ---: |");
  for (const row of results.audit.categoryTable) {
    lines.push(`| ${row.title} | ${row.correlationWithVictory} | ${round(row.successDelta * 100, 2)}pp |`);
  }

  lines.push("");
  lines.push("## Auditoria de Balanceamento");
  lines.push("");

  if (results.audit.impactZero.length) {
    lines.push("### Impacto Zero");
    lines.push("");
    for (const item of results.audit.impactZero) lines.push(`- ${item.variable}: ${item.note}`);
    lines.push("");
  }

  if (results.audit.costImbalance.length) {
    lines.push("### Desequilibrio de Custo");
    lines.push("");
    for (const item of results.audit.costImbalance) lines.push(`- ${item.variable}: ${item.note}`);
    lines.push("");
  }

  lines.push("### Gargalo de Influencia");
  lines.push("");
  lines.push(`- Variavel dominante no corte do Portal: ${results.audit.bottleneck.label} (gap medio ${results.audit.bottleneck.gap}).`);
  lines.push("");

  lines.push("### Sugestoes de Ajuste");
  lines.push("");
  if (results.audit.suggestions.length) {
    for (const suggestion of results.audit.suggestions) lines.push(`- ${suggestion}`);
  } else {
    lines.push("- Sem ajuste critico imediato; balanceamento dentro do esperado para esta rodada.");
  }

  lines.push("");
  lines.push("## Viabilidade all-in Dia 109");
  lines.push("");
  lines.push(`- Avaliados: ${results.allInDay109.evaluated}`);
  lines.push(`- Alcancam o centro: ${results.allInDay109.reachable}`);
  lines.push(`- Bloqueados por tempo: ${results.allInDay109.blocked}`);
  lines.push(`- Taxa de viabilidade: ${results.allInDay109.reachRatePct}%`);
  lines.push(`- ETA medio: ${results.allInDay109.avgEtaHours}h`);
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const calibration = calibrateBalance();
  const baselineRuns = calibration.runs;
  const baseline = buildSummary(baselineRuns);
  const allInRuns = runBatch(calibration.balance, { forceRegroupDay: ALL_IN_DAY });
  const allInDay109 = aggregateAllIn(allInRuns);

  const records = gatherRecords(baselineRuns);
  const audit = buildSensitivityAudit(records, baseline.checkpoints);

  const results = {
    metadata: {
      generatedAt: new Date().toISOString(),
      world: { days: WORLD.days, players: WORLD.players, humans: WORLD.humans, bots: WORLD.bots },
      seeds: WORLD_SEEDS,
      seedScenarios: WORLD_SEED_SCENARIOS,
      version: "season_v3_balance_sensitivity",
    },
    rules: {
      influenceCap: INFLUENCE_CAP,
      portalCut: PORTAL_CUT,
      influenceDefinition: "Soma de estado atual, sem acumulacao diaria",
      influenceFormula: {
        buildings: 1000,
        king: 200,
        council: 400,
        military: 200,
        regicide: 300,
        wonders: 200,
        quest: 100,
        conquestActive: 600,
        domeTribe: 100,
      },
      movement: {
        baseMinutes: BASE_MOVE_TIME_MINUTES,
        roadMinutes: ROAD_MOVE_TIME_MINUTES,
        phase4LogisticsMult: PHASE4_LOGISTICS_MULT,
        hordeInterceptMult: HORDES_INTERCEPT_MULT,
      },
    },
    balance: calibration.balance,
    calibration: {
      iterations: calibration.history,
      targetHit: calibration.targetHit,
      metrics: calibration.metrics,
      targetRangeDay90: "10-15 elegiveis >= 1500 e media ~1550",
    },
    baseline,
    audit,
    allInDay109,
  };

  const seedCsv = toCsv(results.baseline.table, [
    "seed",
    "scenarioId",
    "capitalStyle",
    "day90Eligible",
    "portalSurvivors",
    "aliveAtEnd",
    "humansAliveAtEnd",
    "firstSecondVillageDay",
    "firstVillage100Day",
    "maxInfluenceObserved",
  ]);

  const dailyCsv = toCsv(results.baseline.dailyAverages, [
    "day",
    "alivePlayers",
    "villagesActive",
    "avgLevelTotal",
    "avgMilitaryRanking",
    "avgInfluence",
    "eligiblePlayers",
  ]);

  const windowsCsv = toCsv(results.baseline.phaseWindows, [
    "phase",
    "startDay",
    "endDay",
    "avgAlivePlayers",
    "avgVillagesActive",
    "avgLevelTotal",
    "avgInfluence",
    "avgEligiblePlayers",
  ]);

  const profilesCsv = toCsv(results.baseline.profileComparative, [
    "profileKey",
    "label",
    "sample",
    "portalEntryRatePct",
    "day90Influence",
    "day90Building",
    "day90Council",
    "day90Military",
    "day90Regicide",
    "firstSecondVillageDay",
    "firstVillage100Day",
    "day120TroopRetentionPct",
  ]);

  const auditCsv = toCsv(results.audit.impacts, [
    "label",
    "category",
    "correlation",
    "deltaRate",
    "median",
  ]);

  fs.writeFileSync(path.join(OUTPUT_DIR, `${OUTPUT_BASENAME}_results.json`), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, `${OUTPUT_BASENAME}_report.md`), buildReport(results));
  fs.writeFileSync(path.join(OUTPUT_DIR, `${OUTPUT_BASENAME}_multi_seed.csv`), seedCsv);
  fs.writeFileSync(path.join(OUTPUT_DIR, `${OUTPUT_BASENAME}_daily.csv`), dailyCsv);
  fs.writeFileSync(path.join(OUTPUT_DIR, `${OUTPUT_BASENAME}_phase_windows.csv`), windowsCsv);
  fs.writeFileSync(path.join(OUTPUT_DIR, `${OUTPUT_BASENAME}_profiles.csv`), profilesCsv);
  fs.writeFileSync(path.join(OUTPUT_DIR, `${OUTPUT_BASENAME}_audit.csv`), auditCsv);

  console.log(JSON.stringify(results, null, 2));
}

main();
