import type { BuildingId } from "@/lib/buildings";
import { BASE_MOVE_TIME_MINUTES, ROAD_MOVE_TIME_MINUTES, WORLD_HEX_RADIUS } from "@/lib/world-map-config";
import type { CityClass, CityOriginKind, TerrainKind } from "@/lib/cities";
import type { HeroSpecialistId } from "@/lib/council";

export type WorldSummary = {
  id: string;
  name: string;
  status: "Em Aberto" | "Em Andamento" | "Finalizado";
  day: number;
  phase: string;
  players: number;
  actionLabel: string;
};

export type VillageBuildingLevels = Partial<Record<BuildingId, number>>;

export type VillageSummary = {
  id: string;
  name: string;
  type: "Capital" | "Colonia";
  cityClass?: CityClass;
  cityClassLocked?: boolean;
  originKind?: CityOriginKind;
  terrainKind?: TerrainKind;
  terrainLabel?: string;
  politicalState: string;
  materials: number;
  supplies: number;
  energy: number;
  influence: number;
  palaceLevel: number;
  kingHere: boolean;
  princeHere: boolean;
  underAttack: boolean;
  deficits: string[];
  buildingLevels: VillageBuildingLevels;
};

export type ResearchEntry = {
  name: string;
  branch: string;
  level: number;
  progress: number;
  eta: string;
};

export type TimelineEntry = {
  title: string;
  detail: string;
  eta: string;
  priority: "critico" | "alto" | "medio" | "baixo";
};

export type BuildingEntry = {
  name: string;
  level: number;
  nextCost: string;
  nextTime: string;
  effect: string;
};

export type BoardSite = {
  name: string;
  owner: string;
  type: string;
  cityClass?: CityClass;
  recommendedCityClass?: CityClass;
  occupationKind?: CityOriginKind;
  terrainKind?: TerrainKind;
  terrainLabel?: string;
  relation: "Proprio" | "Aliado" | "Inimigo" | "Neutro";
  coord: string;
  axial: {
    q: number;
    r: number;
  };
  state: string;
};

export type ReportCategory = "movimento" | "combate" | "espionagem" | "economia";

export type ReportEntry = {
  id: string;
  category: ReportCategory;
  type: string;
  title: string;
  summary: string;
  details: string[];
  time: string;
  unread: boolean;
};

export type WorldState = {
  id: string;
  name: string;
  day: number;
  phase: string;
  averageInfluenceScore: number;
  activeAlerts: string[];
  activeVillageId: string;
  villages: VillageSummary[];
  researches: ResearchEntry[];
  timeline: TimelineEntry[];
  buildings: BuildingEntry[];
  boardSites: BoardSite[];
  reports: ReportEntry[];
  mobilization: {
    available: boolean;
    active: boolean;
    speedPenaltyMult: number;
    interceptRiskMult: number;
    orderLabel: string;
    narrative: string;
  };
  tribe: {
    name: string;
    citadelStatus: string;
    totalScore: number;
    rank: number;
    membersAlive: number;
  };
  sovereignty: {
    kingAlive: boolean;
    councilHeroes: number;
    councilComposition?: HeroSpecialistId[];
    militaryRankingPoints: number;
    wondersControlled: number;
    eraQuestsCompleted: number;
    tribeDomeUnlocked: boolean;
    tribeLoyaltyStage?: number;
  };
};

function levels(input: VillageBuildingLevels): VillageBuildingLevels {
  return input;
}

export const worlds: WorldSummary[] = [
  {
    id: "world-01",
    name: "Mundo 01 - Coroa de Cinza",
    status: "Em Andamento",
    day: 94,
    phase: "Fase 4 - Exodo",
    players: 38,
    actionLabel: "Entrar",
  },
  {
    id: "world-02",
    name: "Mundo 02 - Trono Partido",
    status: "Em Aberto",
    day: 0,
    phase: "Aguardando inicio",
    players: 12,
    actionLabel: "Registrar",
  },
  {
    id: "world-test",
    name: "Mundo Teste - Sandbox do GM",
    status: "Em Andamento",
    day: 0,
    phase: "Aguardando GM",
    players: 1,
    actionLabel: "Abrir Sandbox",
  },
  {
    id: "world-00",
    name: "Mundo 00 - Fundadores",
    status: "Finalizado",
    day: 120,
    phase: "Encerrado",
    players: 50,
    actionLabel: "Ver ranking",
  },
];

export const worldMapRules = {
  hexRadius: WORLD_HEX_RADIUS,
  baseMoveTimeMinutes: BASE_MOVE_TIME_MINUTES,
  roadMoveTimeMinutes: ROAD_MOVE_TIME_MINUTES,
};

export const profile = {
  username: "Afonso",
  globalScore: 184250,
  medals: ["Soberano do Mundo", "Sobrevivente do Apocalipse", "Top Apoiador"],
  history: [
    { world: "Mundo 00 - Fundadores", rank: 2, tribe: "Lua Negra" },
    { world: "Mundo 0X - Teste de Cerco", rank: 5, tribe: "Aco Real" },
  ],
};

const worldState: WorldState = {
  id: "world-01",
  name: "Mundo 01 - Coroa de Cinza",
  day: 94,
  phase: "Fase 4 - Exodo",
  averageInfluenceScore: 1315,
  activeAlerts: [
    "Influencia imperial abaixo do corte para o Portal",
    "Marcha final ao Centro liberada",
    "Horda pesada avanca no Distrito C",
  ],
  activeVillageId: "v-capital",
  villages: [
    {
      id: "v-capital",
      name: "Aurea Prime",
      type: "Capital",
      cityClass: "metropole",
      cityClassLocked: false,
      originKind: "claimed_city",
      terrainKind: "crown_heartland",
      terrainLabel: "Coracao da Coroa",
      politicalState: "Comando ativo",
      materials: 18240,
      supplies: 9550,
      energy: 6120,
      influence: 1340,
      palaceLevel: 10,
      kingHere: true,
      princeHere: false,
      underAttack: false,
      deficits: [],
      buildingLevels: levels({ palace: 10, senate: 9, mines: 9, farms: 9, housing: 8, research: 8, barracks: 8, arsenal: 8, wall: 9, wonder: 0 }),
    },
    {
      id: "v-south",
      name: "Vigia do Sul",
      type: "Colonia",
      cityClass: "posto_avancado",
      cityClassLocked: true,
      originKind: "claimed_city",
      terrainKind: "frontier_pass",
      terrainLabel: "Passagem de Fronteira",
      politicalState: "Resistencia local",
      materials: 9410,
      supplies: 4820,
      energy: 2250,
      influence: 240,
      palaceLevel: 8,
      kingHere: false,
      princeHere: true,
      underAttack: true,
      deficits: ["Suprimento apertado"],
      buildingLevels: levels({ palace: 8, senate: 7, mines: 7, farms: 8, housing: 7, research: 6, barracks: 8, arsenal: 6, wall: 8, wonder: 0 }),
    },
    {
      id: "v-east",
      name: "Pedra Fria",
      type: "Colonia",
      cityClass: "bastiao",
      cityClassLocked: true,
      originKind: "claimed_city",
      terrainKind: "ironridge",
      terrainLabel: "Escarpa de Ferro",
      politicalState: "Sucessao apta",
      materials: 12110,
      supplies: 7010,
      energy: 3180,
      influence: 380,
      palaceLevel: 8,
      kingHere: false,
      princeHere: false,
      underAttack: false,
      deficits: ["Energia no limite"],
      buildingLevels: levels({ palace: 8, senate: 7, mines: 8, farms: 7, housing: 7, research: 7, barracks: 7, arsenal: 6, wall: 6, wonder: 0 }),
    },
    {
      id: "v-rubro",
      name: "Vale Rubro",
      type: "Colonia",
      cityClass: "celeiro",
      cityClassLocked: true,
      originKind: "claimed_city",
      terrainKind: "riverlands",
      terrainLabel: "Varzea dos Rios",
      politicalState: "Linha de frente",
      materials: 8740,
      supplies: 5320,
      energy: 2840,
      influence: 290,
      palaceLevel: 7,
      kingHere: false,
      princeHere: false,
      underAttack: true,
      deficits: [],
      buildingLevels: levels({ palace: 7, senate: 6, mines: 7, farms: 7, housing: 6, research: 6, barracks: 8, arsenal: 7, wall: 6, wonder: 0 }),
    },
    {
      id: "v-north",
      name: "Baluarte Norte",
      type: "Colonia",
      cityClass: "bastiao",
      cityClassLocked: true,
      originKind: "claimed_city",
      terrainKind: "ironridge",
      terrainLabel: "Escarpa de Ferro",
      politicalState: "Defesa elevada",
      materials: 9900,
      supplies: 6110,
      energy: 3360,
      influence: 350,
      palaceLevel: 7,
      kingHere: false,
      princeHere: false,
      underAttack: false,
      deficits: [],
      buildingLevels: levels({ palace: 7, senate: 6, mines: 6, farms: 7, housing: 6, research: 6, barracks: 7, arsenal: 6, wall: 7, wonder: 0 }),
    },
    {
      id: "v-porto",
      name: "Porto de Cinza",
      type: "Colonia",
      politicalState: "Logistica principal",
      materials: 11220,
      supplies: 6420,
      energy: 3950,
      influence: 420,
      palaceLevel: 7,
      kingHere: false,
      princeHere: false,
      underAttack: false,
      deficits: [],
      buildingLevels: levels({ palace: 7, senate: 6, mines: 6, farms: 6, housing: 7, research: 6, barracks: 6, arsenal: 5, wall: 5, wonder: 0 }),
    },
    {
      id: "v-solar",
      name: "Campo Solar",
      type: "Colonia",
      politicalState: "Economia estavel",
      materials: 10380,
      supplies: 7540,
      energy: 3010,
      influence: 300,
      palaceLevel: 6,
      kingHere: false,
      princeHere: false,
      underAttack: false,
      deficits: [],
      buildingLevels: levels({ palace: 6, senate: 5, mines: 7, farms: 7, housing: 6, research: 5, barracks: 5, arsenal: 5, wall: 5, wonder: 0 }),
    },
    {
      id: "v-torres",
      name: "Torres Gemeas",
      type: "Colonia",
      politicalState: "Guarnicao media",
      materials: 8340,
      supplies: 5280,
      energy: 2610,
      influence: 250,
      palaceLevel: 6,
      kingHere: false,
      princeHere: false,
      underAttack: false,
      deficits: [],
      buildingLevels: levels({ palace: 6, senate: 5, mines: 5, farms: 6, housing: 6, research: 5, barracks: 6, arsenal: 5, wall: 5, wonder: 0 }),
    },
    {
      id: "v-leste",
      name: "Fronteira Leste",
      type: "Colonia",
      politicalState: "Ameaca constante",
      materials: 7220,
      supplies: 4180,
      energy: 2300,
      influence: 190,
      palaceLevel: 5,
      kingHere: false,
      princeHere: false,
      underAttack: true,
      deficits: ["Muralha fragil"],
      buildingLevels: levels({ palace: 5, senate: 4, mines: 5, farms: 5, housing: 5, research: 4, barracks: 6, arsenal: 4, wall: 6, wonder: 0 }),
    },
    {
      id: "v-chuva",
      name: "Santuario da Chuva",
      type: "Colonia",
      politicalState: "Retaguarda",
      materials: 6890,
      supplies: 5010,
      energy: 2180,
      influence: 220,
      palaceLevel: 5,
      kingHere: false,
      princeHere: false,
      underAttack: false,
      deficits: ["Baixa influencia"],
      buildingLevels: levels({ palace: 5, senate: 4, mines: 5, farms: 6, housing: 5, research: 4, barracks: 4, arsenal: 4, wall: 5, wonder: 0 }),
    },
  ],
  researches: [
    { name: "Resiliencia Apocaliptica", branch: "Apocalipse", level: 4, progress: 72, eta: "00h48" },
    { name: "Governanca Imperial", branch: "Governanca", level: 6, progress: 0, eta: "Fila" },
    { name: "Logistica de Cercos", branch: "Logistica", level: 5, progress: 0, eta: "Fila" },
  ],
  timeline: [
    {
      title: "Check de Influencia",
      detail: "Atingir 1.500 pontos para acesso seguro ao Portal",
      eta: "00h54",
      priority: "critico",
    },
    {
      title: "Horda no Distrito C",
      detail: "Reforcos exigidos em Fronteira Leste",
      eta: "01h26",
      priority: "critico",
    },
    {
      title: "Marcha para o Centro",
      detail: "Tres colunas em deslocamento para q:0 r:0",
      eta: "02h10",
      priority: "alto",
    },
    {
      title: "Conselho de Herois",
      detail: "Aguardando 2 vagas para completar o conselho",
      eta: "--",
      priority: "medio",
    },
  ],
  buildings: [
    {
      name: "Palacio",
      level: 10,
      nextCost: "Maximo de temporada",
      nextTime: "--",
      effect: "+ comando politico",
    },
    {
      name: "Senado",
      level: 9,
      nextCost: "3.980 Materiais / 740 Energia / 220 Influencia",
      nextTime: "02h26",
      effect: "+ cap de influencia",
    },
    {
      name: "Minas",
      level: 9,
      nextCost: "2.460 Materiais / 420 Energia / 120 Influencia",
      nextTime: "01h42",
      effect: "+ producao de materiais",
    },
    {
      name: "Fazendas",
      level: 9,
      nextCost: "2.380 Materiais / 380 Energia / 112 Influencia",
      nextTime: "01h36",
      effect: "+ producao de suprimentos",
    },
    {
      name: "Habitacoes",
      level: 8,
      nextCost: "2.120 Materiais / 360 Energia / 102 Influencia",
      nextTime: "01h28",
      effect: "+ capacidade civil",
    },
    {
      name: "C. Pesquisa",
      level: 8,
      nextCost: "2.320 Materiais / 420 Energia / 126 Influencia",
      nextTime: "01h34",
      effect: "+ velocidade de pesquisa",
    },
    {
      name: "M. Viaria",
      level: 6,
      nextCost: "3.450 Materiais / 590 Energia / 170 Influencia",
      nextTime: "02h58",
      effect: "+ logistica entre territorios proprios",
    },
    {
      name: "Quartel",
      level: 8,
      nextCost: "2.200 Materiais / 400 Energia / 118 Influencia",
      nextTime: "01h40",
      effect: "+ capacidade de treinamento",
    },
    {
      name: "Arsenal",
      level: 8,
      nextCost: "2.360 Materiais / 430 Energia / 124 Influencia",
      nextTime: "01h44",
      effect: "+ oficiais e elite militar",
    },
    {
      name: "Muralha",
      level: 9,
      nextCost: "2.900 Materiais / 460 Energia / 132 Influencia",
      nextTime: "02h06",
      effect: "+ defesa estrutural da Coroa",
    },
    {
      name: "Maravilha",
      level: 0,
      nextCost: "Exige aldeia 90/90",
      nextTime: "--",
      effect: "+ 10 pontos finais da aldeia",
    },
  ],
  boardSites: [
    {
      name: "Aurea Prime",
      owner: "Afonso",
      type: "Capital",
      occupationKind: "claimed_city",
      terrainKind: "crown_heartland",
      terrainLabel: "Coracao da Coroa",
      cityClass: "metropole",
      relation: "Proprio",
      coord: "14:09",
      axial: { q: 14, r: 9 },
      state: "Rei estacionado",
    },
    {
      name: "Cidadela da Lua Negra",
      owner: "Lua Negra",
      type: "Cidadela",
      occupationKind: "claimed_city",
      terrainKind: "ironridge",
      terrainLabel: "Escarpa de Ferro",
      cityClass: "bastiao",
      relation: "Aliado",
      coord: "17:11",
      axial: { q: 17, r: 11 },
      state: "Sob ameaca de horda",
    },
    {
      name: "Muralha de Sal",
      owner: "Casa Ruun",
      type: "Colonia",
      occupationKind: "claimed_city",
      terrainKind: "frontier_pass",
      terrainLabel: "Passagem de Fronteira",
      cityClass: "posto_avancado",
      relation: "Inimigo",
      coord: "20:08",
      axial: { q: 20, r: 8 },
      state: "Espionada ha 12 min",
    },
    {
      name: "Campo Quebrado",
      owner: "Neutro",
      type: "Ruina",
      occupationKind: "abandoned_city",
      terrainKind: "ashen_fields",
      terrainLabel: "Campos de Cinza",
      recommendedCityClass: "neutral",
      relation: "Neutro",
      coord: "12:14",
      axial: { q: 12, r: 14 },
      state: "Territorio devastado",
    },
  ],
  reports: [
    {
      id: "r-mov-01",
      category: "movimento",
      type: "Logistica Interna",
      title: "Eixo Norte recebeu comboio de Materiais",
      summary: "Transferencia concluida entre Porto de Cinza e Baluarte Norte.",
      details: [
        "Materiais enviados: 3.200",
        "Suprimentos enviados: 1.480",
        "Tempo da rota: 01h52",
      ],
      time: "ha 05 min",
      unread: true,
    },
    {
      id: "r-mov-02",
      category: "movimento",
      type: "Guarnicao",
      title: "Reforco aliado chegou em Fronteira Leste",
      summary: "Destacamento da Lua Negra entrou na muralha secundaria.",
      details: [
        "Infantaria pesada: +420",
        "Arqueiros: +180",
        "Estado da muralha: estabilizado",
      ],
      time: "ha 11 min",
      unread: true,
    },
    {
      id: "r-com-01",
      category: "combate",
      type: "Calculo de Choque",
      title: "Choque em Vale Rubro",
      summary: "Ataque inimigo repelido com perdas moderadas.",
      details: [
        "Forca atacante: 3.980",
        "Forca defensora: 4.620",
        "Baixas atacante: 44% | baixas defesa: 27%",
      ],
      time: "ha 17 min",
      unread: true,
    },
    {
      id: "r-com-02",
      category: "combate",
      type: "Efeito de Ruptura",
      title: "Regicida confirmado na Cidadela de Sal",
      summary: "Golpe final na capital rival consolidou bonus de soberania.",
      details: [
        "Capital conquistada por ruptura militar",
        "Rei inimigo abatido",
        "Bonus permanente de Regicida aplicado: +50",
      ],
      time: "ha 23 min",
      unread: true,
    },
    {
      id: "r-esp-01",
      category: "espionagem",
      type: "Inteligencia Incompleta",
      title: "Leitura parcial de Casa Ruun",
      summary: "Espiao retornou com dados de edificios e guarnicao.",
      details: [
        "Palacio estimado: Nivel 8",
        "Tropas estacionadas: ~1.900",
        "Presenca da Coroa: possivel (nao confirmada)",
      ],
      time: "ha 29 min",
      unread: false,
    },
    {
      id: "r-eco-01",
      category: "economia",
      type: "Extrato de Producao",
      title: "Balanco de 6h de manutencao",
      summary: "Producao positiva, mas upkeep militar pressionando suprimentos.",
      details: [
        "Materiais: +5.440",
        "Suprimentos: +2.180 (upkeep: -1.760)",
        "Energia: +1.320",
      ],
      time: "ha 32 min",
      unread: false,
    },
    {
      id: "r-eco-02",
      category: "economia",
      type: "Saques",
      title: "Perda de estoque apos incursao",
      summary: "Invasao rapida em Campo Solar removeu parte da reserva.",
      details: [
        "Materiais perdidos: 1.240",
        "Suprimentos perdidos: 510",
        "Recuperacao em curso por rota interna",
      ],
      time: "ha 41 min",
      unread: false,
    },
  ],
  mobilization: {
    available: true,
    active: true,
    speedPenaltyMult: 5,
    interceptRiskMult: 3,
    orderLabel: "Reagrupar Imperio",
    narrative: "Na Fase IV, o reagrupamento impõe marcha x5 ao Centro e eleva o risco de interceptacao pelas Hordas.",
  },
  tribe: {
    name: "Lua Negra",
    citadelStatus: "Ativa, sob ameaca",
    totalScore: 912400,
    rank: 3,
    membersAlive: 18,
  },
  sovereignty: {
    kingAlive: true,
    councilHeroes: 2,
    councilComposition: ["engineer", "erudite"],
    militaryRankingPoints: 320,
    eraQuestsCompleted: 2,
    wondersControlled: 2,
    tribeDomeUnlocked: true,
    tribeLoyaltyStage: 3,
  },
};

const sandboxWorldState: WorldState = {
  ...worldState,
  id: "world-test",
  name: "Mundo Teste - Sandbox do GM",
  day: 0,
  phase: "Aguardando GM",
  averageInfluenceScore: 24,
  activeAlerts: [
    "Mundo pausado. Aguarde o comando Begin do GM.",
    "Tempo real desligado.",
  ],
  villages: [
    {
      id: "v-capital",
      name: "Aurea Prime",
      type: "Capital",
      cityClass: "metropole",
      cityClassLocked: false,
      originKind: "claimed_city",
      terrainKind: "crown_heartland",
      terrainLabel: "Coracao da Coroa",
      politicalState: "Preparando a fundacao do reino",
      materials: 920,
      supplies: 640,
      energy: 260,
      influence: 42,
      palaceLevel: 1,
      kingHere: true,
      princeHere: false,
      underAttack: false,
      deficits: ["Caixa curto", "Sem rede externa"],
      buildingLevels: levels({ palace: 1, senate: 1, mines: 2, farms: 2, housing: 1, research: 1, barracks: 1, arsenal: 0, wall: 0, wonder: 0 }),
    },
  ],
  researches: [
    { name: "Planejamento Urbano", branch: "Urbana", level: 1, progress: 18, eta: "03h20" },
    { name: "Doutrina Tatica", branch: "Tatical", level: 1, progress: 8, eta: "05h10" },
    { name: "Malha de Fluxo", branch: "Fluxo", level: 1, progress: 12, eta: "04h40" },
  ],
  timeline: [
    { title: "Elevar Minas e Fazendas", detail: "Feche o eixo de recursos ate nivel 3 antes da 2a cidade.", eta: "Dia 1-3", priority: "alto" },
    { title: "Abrir Quartel basal", detail: "So o suficiente para a primeira patrulha imperial.", eta: "Dia 2-4", priority: "medio" },
    { title: "Preparar 2a cidade", detail: "InfluÃªncia e materiais precisam fechar o custo de expansao.", eta: "Dia 12-18", priority: "critico" },
  ],
  reports: [],
  mobilization: {
    available: false,
    active: false,
    speedPenaltyMult: 5,
    interceptRiskMult: 3,
    orderLabel: "Aguardando Fase IV",
    narrative: "No sandbox, a marcha final so destrava quando voce avancar ate a Fase IV.",
  },
  sovereignty: {
    kingAlive: true,
    councilHeroes: 0,
    councilComposition: [],
    militaryRankingPoints: 40,
    eraQuestsCompleted: 0,
    wondersControlled: 0,
    tribeDomeUnlocked: false,
    tribeLoyaltyStage: 0,
  },
};

export function getWorldState(worldId: string): WorldState {
  if (worldId === sandboxWorldState.id) {
    return sandboxWorldState;
  }

  if (worldId === worldState.id) {
    return worldState;
  }

  return {
    ...worldState,
    id: worldId,
    name: `Mundo ${worldId}`,
  };
}

export function getWorldSummary(worldId: string): WorldSummary | undefined {
  return worlds.find((world) => world.id === worldId);
}





