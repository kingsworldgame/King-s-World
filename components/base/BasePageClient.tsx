"use client";

import { useEffect, useMemo, useState } from "react";

import type { EvolutionMode } from "@/core/GameBalance";
import { VillageCommandPanel } from "@/components/base/VillageCommandPanel";
import { VillageScene } from "@/components/base/VillageScene";
import { SandboxOpeningPanel } from "@/components/sandbox/SandboxOpeningPanel";
import type { BuildingId } from "@/lib/buildings";
import { mergeImperialVillages, useImperialState } from "@/lib/imperial-state";
import type { ResearchEntry, TimelineEntry, VillageSummary } from "@/lib/mock-data";
import type { SandboxStrategyPlaybook, SandboxStrategyId } from "@/lib/sandbox-playbooks";
import { emitUiFeedback } from "@/lib/ui-feedback";

export type LocalCommand = "guard" | "drill" | "sortie" | "fortify" | "rations";
export type BaseSubTab = "city" | "command";

const MODE_LABEL: Record<EvolutionMode, string> = {
  balanced: "Balanceado",
  metropole: "Metropole",
  vanguard: "Posto Avancado",
  bastion: "Bastiao",
  flow: "Fluxo",
};

const BASE_SUBTAB_META: Record<BaseSubTab, { label: string }> = {
  city: { label: "Cidade" },
  command: { label: "Comando" },
};

const LOCAL_COMMAND_IDS: LocalCommand[] = ["guard", "drill", "sortie", "fortify", "rations"];

const LOCAL_COMMAND_META: Record<LocalCommand, { label: string; summary: string }> = {
  guard: { label: "Guarnicao", summary: "Cidade entra em prioridade de defesa e puxa resposta automatica da legiao central." },
  drill: { label: "Treino", summary: "Melhora o recrutamento na Capital com lote maior e custo menor." },
  sortie: { label: "Sortida", summary: "Postura ofensiva para pressao, saque e ataque escolhido no mapa." },
  fortify: { label: "Blindar", summary: "Empurra muralha, seguranca local e preparo anti-horda." },
  rations: { label: "Racao", summary: "Economiza suprimento e energia para sustentar campanha longa." },
};

type BasePageClientProps = {
  worldId: string;
  villages: VillageSummary[];
  researches: ResearchEntry[];
  timeline: TimelineEntry[];
  selectedVillageId: string;
  evolutionMode: EvolutionMode;
  initialLocalCommand: LocalCommand;
  initialSubTab: BaseSubTab;
  initialSelectedBuildingId: BuildingId | null;
  sandboxPlaybooks?: Record<SandboxStrategyId, SandboxStrategyPlaybook>;
};

export function BasePageClient({
  worldId,
  villages,
  researches,
  timeline,
  selectedVillageId,
  evolutionMode,
  initialLocalCommand,
  initialSubTab,
  initialSelectedBuildingId,
  sandboxPlaybooks,
}: BasePageClientProps) {
  const [subTab, setSubTab] = useState<BaseSubTab>(initialSubTab);
  const [localCommand, setLocalCommand] = useState<LocalCommand>(initialLocalCommand);
  const [commandFeedback, setCommandFeedback] = useState<string>(LOCAL_COMMAND_META[initialLocalCommand].summary);
  const { imperialState } = useImperialState(worldId, villages);
  const mergedVillages = mergeImperialVillages(villages, imperialState);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  useEffect(() => {
    setLocalCommand(initialLocalCommand);
    setCommandFeedback(LOCAL_COMMAND_META[initialLocalCommand].summary);
  }, [initialLocalCommand]);

  const activeVillage = mergedVillages.find((entry) => entry.id === selectedVillageId) ?? mergedVillages[0];
  const commandImpact = useMemo(() => {
    if (localCommand === "drill") return "Recruta mais por clique e reduz custo do lote.";
    if (localCommand === "sortie") return "Empurra o jogo para pressao ofensiva e resposta rapida.";
    if (localCommand === "fortify") return "Sobe foco defensivo e segura melhor ataques e horda.";
    if (localCommand === "rations") return "Mantem campanha viva por mais tempo com economia melhor.";
    return "Mantem a cidade em postura estavel com resposta automatica mais segura.";
  }, [localCommand]);

  return (
    <>
      {sandboxPlaybooks ? (
        <SandboxOpeningPanel
          worldId={worldId}
          villages={mergedVillages}
          selectedVillageId={selectedVillageId}
          playbooks={sandboxPlaybooks}
        />
      ) : null}

      <article className="kw-glass mb-2 rounded-2xl p-2">
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(BASE_SUBTAB_META) as BaseSubTab[]).map((tab) => {
            const active = tab === subTab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  emitUiFeedback("tap", "light");
                  setSubTab(tab);
                }}
                className={`rounded-xl border px-2 py-1.5 text-center text-xs font-semibold transition ${
                  active
                    ? "border-sky-300/55 bg-sky-500/20 text-sky-100"
                    : "border-white/20 bg-white/6 text-slate-300 hover:bg-white/10"
                }`}
              >
                {BASE_SUBTAB_META[tab].label}
              </button>
            );
          })}
        </div>
      </article>

      {subTab === "command" ? (
        <>
          <article className="kw-glass mb-2 rounded-2xl p-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">Chips da Cidade</p>
              <p className="text-[11px] font-semibold text-cyan-100">{LOCAL_COMMAND_META[localCommand].label}</p>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {LOCAL_COMMAND_IDS.map((chip) => {
                const active = chip === localCommand;
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      emitUiFeedback("tap", "light");
                      setLocalCommand(chip);
                      setCommandFeedback(LOCAL_COMMAND_META[chip].summary);
                    }}
                    className={`rounded-xl border px-2 py-1.5 text-center text-[10px] font-semibold transition ${
                      active
                        ? "border-sky-300/55 bg-sky-500/20 text-sky-100"
                        : "border-white/20 bg-white/6 text-slate-300 hover:bg-white/10"
                    }`}
                    title={LOCAL_COMMAND_META[chip].summary}
                  >
                    {LOCAL_COMMAND_META[chip].label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-slate-300">
              Postura local da cidade. Politicas globais de evolucao estao na aba Operacoes ({MODE_LABEL[evolutionMode]}).
            </p>
            <div className="kw-action-banner kw-action-banner--info mt-2">
              <p className="text-[11px] font-semibold text-white">Impacto imediato: {commandImpact}</p>
              <p className="mt-0.5 text-[11px] text-slate-200">{commandFeedback}</p>
            </div>
          </article>

          <VillageCommandPanel worldId={worldId} village={activeVillage} villages={mergedVillages} localCommand={localCommand} />
        </>
      ) : (
        <VillageScene
          worldId={worldId}
          villages={mergedVillages}
          village={activeVillage}
          researchEntries={researches}
          timelineEntries={timeline}
          evolutionMode={evolutionMode}
          localCommand={localCommand}
          initialSelectedBuildingId={initialSelectedBuildingId}
        />
      )}
    </>
  );
}
