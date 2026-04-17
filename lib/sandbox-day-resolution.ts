"use client";

import { BUILDING_NAME_TO_ID, type BuildingId } from "@/lib/buildings";
import type { ImperialResources, ImperialTroops } from "@/lib/imperial-state";

export type SandboxDayResolution = {
  resources: ImperialResources;
  troops: ImperialTroops;
  notes: string[];
  actionCount: number;
};

function emptyResources(): ImperialResources {
  return { materials: 0, supplies: 0, energy: 0, influence: 0 };
}

function emptyTroops(): ImperialTroops {
  return { militia: 0, shooters: 0, scouts: 0, machinery: 0 };
}

function addNote(notes: string[], note: string) {
  if (!notes.includes(note)) {
    notes.push(note);
  }
}

function parseBuildingAction(action: string): { buildingId: BuildingId; targetLevel: number } | null {
  const match = action.match(/^(.*?)(?: foco)? -> Nv (\d+)/i);
  if (!match) {
    return null;
  }

  const buildingId = BUILDING_NAME_TO_ID[match[1].trim()];
  if (!buildingId) {
    return null;
  }

  return {
    buildingId,
    targetLevel: Number(match[2]),
  };
}

export function getSandboxRewardScale(day: number): number {
  if (day <= 3) return 0.22;
  if (day <= 7) return 0.36;
  if (day <= 14) return 0.52;
  if (day <= 30) return 0.72;
  if (day <= 60) return 0.9;
  return 1;
}

export function collectCompletedActionsForDay(actionIds: string[], day: number): string[] {
  return actionIds.flatMap((actionId) => {
    const match = actionId.match(/^[^:]+:(\d+):(.+)$/);
    if (!match) {
      return [];
    }

    return Number(match[1]) === day ? [match[2]] : [];
  });
}

export function resolveSandboxDay(day: number, actions: string[]): SandboxDayResolution {
  const resources = emptyResources();
  const troops = emptyTroops();
  const notes: string[] = [];
  const rewardScale = getSandboxRewardScale(day);

  for (const action of actions) {
    const buildingAction = parseBuildingAction(action);
    if (buildingAction) {
      const level = Math.max(1, buildingAction.targetLevel);
      switch (buildingAction.buildingId) {
        case "mines":
          resources.materials += Math.round((90 + level * 28) * rewardScale);
          addNote(notes, `Minas Nv ${level} melhoraram a extração para o próximo dia.`);
          break;
        case "farms":
          resources.supplies += Math.round((84 + level * 26) * rewardScale);
          addNote(notes, `Fazendas Nv ${level} reforçaram o abastecimento do próximo dia.`);
          break;
        case "research":
          resources.energy += Math.round((58 + level * 20) * rewardScale);
          resources.influence += Math.max(1, Math.round((6 + level * 2) * rewardScale));
          addNote(notes, `Pesquisa Nv ${level} elevou energia e leitura política.`);
          break;
        case "palace":
          resources.influence += Math.max(2, Math.round((12 + level * 4) * rewardScale));
          addNote(notes, `Palácio Nv ${level} aumentou a autoridade do reino.`);
          break;
        case "senate":
          resources.influence += Math.max(2, Math.round((16 + level * 5) * rewardScale));
          addNote(notes, `Senado Nv ${level} abriu mais influência institucional.`);
          break;
        case "housing":
          resources.supplies += Math.round((34 + level * 14) * rewardScale);
          addNote(notes, `Habitações Nv ${level} sustentaram mais população ativa.`);
          break;
        case "barracks":
          troops.militia += Math.max(2, Math.round((8 + level * 5) * rewardScale));
          troops.shooters += Math.max(1, Math.round((3 + level * 2) * rewardScale));
          addNote(notes, `Quartel Nv ${level} liberou novo lote de tropas.`);
          break;
        case "arsenal":
          troops.shooters += Math.max(1, Math.round((4 + level * 3) * rewardScale));
          troops.machinery += Math.max(0, Math.round((level - 1) * rewardScale));
          addNote(notes, `Arsenal Nv ${level} melhorou o poder de fogo.`);
          break;
        case "wall":
          resources.influence += Math.max(1, Math.round((5 + level * 2) * rewardScale));
          addNote(notes, `Muralha Nv ${level} fortaleceu o peso defensivo do reino.`);
          break;
        case "wonder":
          resources.influence += Math.max(4, Math.round((28 + level * 8) * rewardScale));
          addNote(notes, `A obra monumental aumentou o prestígio imperial.`);
          break;
        case "roads":
          resources.materials += Math.round((24 + level * 10) * rewardScale);
          resources.supplies += Math.round((18 + level * 8) * rewardScale);
          addNote(notes, `A malha viária fez o fluxo interno render melhor.`);
          break;
      }
      continue;
    }

    const recruitMatch = action.match(/Recrutar .*?(\d+)/i);
    if (recruitMatch) {
      const amount = Math.max(8, Number(recruitMatch[1]));
      troops.militia += amount;
      troops.shooters += Math.round(amount * 0.55);
      troops.scouts += Math.round(amount * 0.35);
      addNote(notes, `O recrutamento do dia virou tropas disponíveis no amanhecer.`);
      continue;
    }

    if (/Buscas|coletas|Vasculhar|saque/i.test(action)) {
      resources.materials += Math.round(260 * rewardScale);
      resources.supplies += Math.round(180 * rewardScale);
      resources.energy += Math.round(80 * rewardScale);
      resources.influence += Math.max(1, Math.round(10 * rewardScale));
      addNote(notes, `A expedição trouxe recursos reais para o estoque.`);
      continue;
    }

    if (/Transferir recursos|Doar recursos/i.test(action)) {
      resources.materials += Math.round((/x5/i.test(action) ? 420 : 160) * rewardScale);
      resources.supplies += Math.round((/x5/i.test(action) ? 320 : 120) * rewardScale);
      resources.energy += Math.round((/x5/i.test(action) ? 180 : 70) * rewardScale);
      resources.influence += Math.max(1, Math.round((/x5/i.test(action) ? 16 : 6) * rewardScale));
      addNote(notes, `As rotas internas entregaram recursos no início do novo dia.`);
      continue;
    }

    if (/Contratou Engenheiro/i.test(action)) {
      resources.materials += Math.round(90 * rewardScale);
      resources.energy += Math.round(40 * rewardScale);
      addNote(notes, `O Engenheiro deixou a economia inicial mais eficiente.`);
      continue;
    }

    if (/Contratou Intendente/i.test(action)) {
      resources.supplies += Math.round(90 * rewardScale);
      addNote(notes, `O Intendente organizou melhor o abastecimento.`);
      continue;
    }

    if (/Contratou Erudito/i.test(action)) {
      resources.energy += Math.round(70 * rewardScale);
      resources.influence += Math.max(1, Math.round(8 * rewardScale));
      addNote(notes, `O Erudito converteu estudo em influência e energia.`);
      continue;
    }

    if (/Contratou Marechal|Contratou Navegador/i.test(action)) {
      resources.influence += Math.max(1, Math.round(8 * rewardScale));
      addNote(notes, `A liderança escolhida aumentou coordenação e presença política.`);
      continue;
    }

    const questMatch = action.match(/Quest (\d)\/3/i);
    if (questMatch) {
      resources.influence += Math.max(3, Math.round((24 + Number(questMatch[1]) * 6) * rewardScale));
      addNote(notes, `A quest concluída virou influência conquistada, não dada.`);
      continue;
    }

    const wonderMatch = action.match(/Maravilha (\d)/i);
    if (wonderMatch) {
      resources.influence += Math.max(4, Math.round((22 + Number(wonderMatch[1]) * 6) * rewardScale));
      addNote(notes, `A Maravilha elevou o peso político do império.`);
      continue;
    }

    if (/Domo da Tribo/i.test(action)) {
      resources.influence += Math.max(3, Math.round(20 * rewardScale));
      addNote(notes, `O Domo da Tribo consolidou influência externa.`);
      continue;
    }

    if (/(\d+)a aldeia/i.test(action)) {
      addNote(notes, `A nova aldeia foi posicionada e ficará pronta para crescer nos próximos dias.`);
      continue;
    }
  }

  return {
    resources,
    troops,
    notes,
    actionCount: actions.length,
  };
}
