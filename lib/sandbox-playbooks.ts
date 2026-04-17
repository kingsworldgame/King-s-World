import fs from "node:fs";
import path from "node:path";
import { cache } from "react";

export type SandboxStrategyId = "metropole" | "posto_avancado" | "bastiao" | "celeiro";

export type SandboxStrategyMeta = {
  id: SandboxStrategyId;
  label: string;
  tagline: string;
  benefit: string;
  risk: string;
  bestFor: string;
  openingGoal: string;
};

export type SandboxDayPlan = {
  day: number;
  influence: number;
  margin: number;
  villages: number;
  troopsLabel: string;
  actions: string[];
  priorities: string[];
  milestone: string;
};

export type SandboxStrategyPlaybook = {
  meta: SandboxStrategyMeta;
  branch: string;
  secondVillageDay: number;
  firstHundredDay: number;
  day90Summary: string;
  day120Summary: string;
  days: SandboxDayPlan[];
};

const EXECUTOR_PATH = path.join(process.cwd(), "simulations", "output", "season_v2_paired8_daily_executor.md");
const PLAYBOOK_PATH = path.join(process.cwd(), "simulations", "output", "season_v2_paired8_daily_playbooks.md");

const STRATEGY_META: Record<SandboxStrategyId, SandboxStrategyMeta> = {
  metropole: {
    id: "metropole",
    label: "Metropole",
    tagline: "Capital monstruosa, conselho forte e corrida cedo para Maravilhas.",
    benefit: "Escala muito bem em influencia e fecha score alto no late game.",
    risk: "Se atrasar a 2a aldeia ou o 100/100, a build fica linda mas lenta demais.",
    bestFor: "Quem quer jogar de forma economica, organizada e com teto alto de score.",
    openingGoal: "Fechar Minas/Fazendas/Palacio/Senado sem desperdiccar recurso e abrir a 2a aldeia cedo.",
  },
  posto_avancado: {
    id: "posto_avancado",
    label: "Posto Avancado",
    tagline: "Pressao de mapa, militar forte e expansao puxada por agressao.",
    benefit: "Ganha ritmo cedo no mapa e converte combate em territorio e tempo.",
    risk: "Se gastar demais em tropa e esquecer economia, o impeto morre no mid game.",
    bestFor: "Quem gosta de atacar, patrulhar, pressionar e crescer no mapa.",
    openingGoal: "Abrir Quartel/Arsenal cedo sem matar a economia basica da Capital.",
  },
  bastiao: {
    id: "bastiao",
    label: "Bastiao",
    tagline: "Defesa robusta, seguranca de aldeia e reta final mais estavel.",
    benefit: "Sofre menos na pressao de hordas e no late game costuma manter aldeias vivas.",
    risk: "Pode atrasar expansao e score se voce se apaixonar demais pela muralha.",
    bestFor: "Quem prefere margem de erro maior, defesa e campanha mais segura.",
    openingGoal: "Subir base economica e muralha sem travar a 2a aldeia.",
  },
  celeiro: {
    id: "celeiro",
    label: "Celeiro",
    tagline: "Fluxo interno, doacao entre aldeias e corrida de ETA no endgame.",
    benefit: "Consegue acelerar o impeto do imperio e corrige distancia com boa logistica.",
    risk: "Se voce nao doar recurso direito, fica rico no papel e lento na pratica.",
    bestFor: "Quem gosta de microgerenciar recursos e brincar de rede logistica.",
    openingGoal: "Abrir Fazendas/Habitacoes cedo, acelerar a 2a aldeia e preparar cadeia de doacao.",
  },
};

const SECTION_TO_ID: Record<string, SandboxStrategyId> = {
  Metropole: "metropole",
  "Posto Avancado": "posto_avancado",
  Bastiao: "bastiao",
  Celeiro: "celeiro",
};

function parseNumber(input: string): number {
  const normalized = input.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

function splitMarkdownRow(row: string): string[] {
  return row
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function extractMetaNumber(line: string): number {
  const match = line.match(/D(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function extractSummary(line: string): string {
  const [, summary = ""] = line.split(":");
  return summary.trim();
}

function parseExecutorSections(raw: string): Record<SandboxStrategyId, Omit<SandboxStrategyPlaybook, "meta" | "days"> & { days: SandboxDayPlan[] }> {
  const sections = raw.split(/\r?\n## /).slice(1);
  const result = {} as Record<SandboxStrategyId, Omit<SandboxStrategyPlaybook, "meta" | "days"> & { days: SandboxDayPlan[] }>;

  for (const section of sections) {
    const lines = section.split(/\r?\n/);
    const heading = lines[0]?.trim() ?? "";
    const sectionName = heading.split(" - ")[0]?.trim();
    const id = SECTION_TO_ID[sectionName];
    if (!id) {
      continue;
    }

    const branchLine = lines.find((line) => line.startsWith("- Branch:")) ?? "";
    const secondVillageLine = lines.find((line) => line.startsWith("- 2a aldeia:")) ?? "";
    const firstHundredLine = lines.find((line) => line.startsWith("- 1a aldeia 100:")) ?? "";
    const day90Line = lines.find((line) => line.startsWith("- D90:")) ?? "";
    const day120Line = lines.find((line) => line.startsWith("- D120:")) ?? "";

    const days: SandboxDayPlan[] = [];
    const tableStart = lines.findIndex((line) => line.startsWith("| Dia |"));
    if (tableStart >= 0) {
      for (let index = tableStart + 2; index < lines.length; index += 1) {
        const line = lines[index];
        if (!line.startsWith("|")) {
          break;
        }
        const cells = splitMarkdownRow(line);
        if (cells.length < 7) {
          continue;
        }
        days.push({
          day: Number(cells[0]),
          influence: parseNumber(cells[1]),
          margin: parseNumber(cells[2]),
          villages: parseNumber(cells[3]),
          troopsLabel: cells[4],
          actions: cells[5].split(" + ").map((entry) => entry.trim()).filter(Boolean),
          priorities: [],
          milestone: cells[6],
        });
      }
    }

    result[id] = {
      branch: extractSummary(branchLine),
      secondVillageDay: extractMetaNumber(secondVillageLine),
      firstHundredDay: extractMetaNumber(firstHundredLine),
      day90Summary: extractSummary(day90Line),
      day120Summary: extractSummary(day120Line),
      days,
    };
  }

  return result;
}

function parsePlaybookPriorities(raw: string): Partial<Record<SandboxStrategyId, Record<number, string[]>>> {
  const sections = raw.split(/\r?\n## /).slice(1);
  const result: Partial<Record<SandboxStrategyId, Record<number, string[]>>> = {};

  for (const section of sections) {
    const lines = section.split(/\r?\n/);
    const heading = lines[0]?.trim() ?? "";
    const sectionName = heading.split(" - ")[0]?.trim();
    const id = SECTION_TO_ID[sectionName];
    if (!id) {
      continue;
    }

    const prioritiesByDay: Record<number, string[]> = {};
    const tableStart = lines.findIndex((line) => line.startsWith("| Dia |"));
    if (tableStart >= 0) {
      for (let index = tableStart + 2; index < lines.length; index += 1) {
        const line = lines[index];
        if (!line.startsWith("|")) {
          break;
        }
        const cells = splitMarkdownRow(line);
        if (cells.length < 9) {
          continue;
        }
        prioritiesByDay[Number(cells[0])] = [cells[5], cells[6], cells[7]].filter(Boolean);
      }
    }

    result[id] = prioritiesByDay;
  }

  return result;
}

export const getSandboxPlaybooks = cache((): Record<SandboxStrategyId, SandboxStrategyPlaybook> => {
  const executorRaw = fs.readFileSync(EXECUTOR_PATH, "utf8");
  const playbookRaw = fs.readFileSync(PLAYBOOK_PATH, "utf8");
  const executor = parseExecutorSections(executorRaw);
  const priorities = parsePlaybookPriorities(playbookRaw);

  return {
    metropole: {
      meta: STRATEGY_META.metropole,
      ...executor.metropole,
      days: executor.metropole.days.map((day) => ({
        ...day,
        priorities: priorities.metropole?.[day.day] ?? [],
      })),
    },
    posto_avancado: {
      meta: STRATEGY_META.posto_avancado,
      ...executor.posto_avancado,
      days: executor.posto_avancado.days.map((day) => ({
        ...day,
        priorities: priorities.posto_avancado?.[day.day] ?? [],
      })),
    },
    bastiao: {
      meta: STRATEGY_META.bastiao,
      ...executor.bastiao,
      days: executor.bastiao.days.map((day) => ({
        ...day,
        priorities: priorities.bastiao?.[day.day] ?? [],
      })),
    },
    celeiro: {
      meta: STRATEGY_META.celeiro,
      ...executor.celeiro,
      days: executor.celeiro.days.map((day) => ({
        ...day,
        priorities: priorities.celeiro?.[day.day] ?? [],
      })),
    },
  };
});
