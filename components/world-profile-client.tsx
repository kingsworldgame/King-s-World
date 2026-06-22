"use client";

import { UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { calculateDefensePower, calculateSovereigntyScore, calculateTroopPower, calculateVillageDevelopment } from "@/core/GameBalance";
import { countUnlockedMilitaryTechs } from "@/lib/empire-systems";
import { mergeImperialVillages, useImperialStateContext } from "@/lib/imperial-state";
import { KING_PROFILE_BY_ID, KING_PROFILES } from "@/lib/king-profiles";
import type { VillageSummary, WorldParticipantRelation, WorldState } from "@/lib/mock-data";
import { getUiSettings, setUiSettings, type UiSettings } from "@/lib/ui-settings";
import { emitUiToast } from "@/lib/ui-feedback";
import { useLiveWorldContext } from "@/lib/world-runtime";

const DEFAULT_KING_PORTRAIT_PRESET = { y: 100, zoom: 100 };
const KING_PORTRAIT_PRESETS: Partial<Record<string, { y: number; zoom: number }>> = {};

const RELATION_LABELS: Record<WorldParticipantRelation, string> = {
  self: "Voce",
  ally: "Aliado",
  neutral: "Neutro",
  wary: "Arisco",
};

const RELATION_CLASSES: Record<WorldParticipantRelation, string> = {
  self: "border-cyan-200/35 bg-cyan-400/14 text-cyan-50",
  ally: "border-emerald-300/35 bg-emerald-400/14 text-emerald-50",
  neutral: "border-slate-300/25 bg-white/8 text-slate-100",
  wary: "border-amber-300/35 bg-amber-400/14 text-amber-50",
};

export function WorldProfileClient({
  worldId,
  world,
  villages,
  username,
}: {
  worldId: string;
  world?: WorldState;
  villages?: VillageSummary[];
  username: string;
}) {
  const router = useRouter();
  const { world: runtimeWorld } = useLiveWorldContext();
  const worldState = world ?? runtimeWorld;
  const villageState = villages ?? runtimeWorld.villages;
  const { imperialState } = useImperialStateContext();
  const mergedVillages = useMemo(() => mergeImperialVillages(villageState, imperialState), [imperialState, villageState]);
  const selectedKing = imperialState.kingProfileId ? KING_PROFILE_BY_ID[imperialState.kingProfileId] : KING_PROFILES[0];
  const kingName = imperialState.kingName ?? selectedKing.name;
  const heroCount = useMemo(
    () => Object.values(imperialState.heroByVillage).filter((hero) => hero && hero !== "none").length,
    [imperialState.heroByVillage],
  );
  const sovereignty = useMemo(
    () =>
      calculateSovereigntyScore({
        villages: mergedVillages,
        villageDevelopments: mergedVillages.map((village) => calculateVillageDevelopment(village.buildingLevels)),
        councilHeroes: heroCount,
        militaryRankingPoints: worldState.sovereignty.militaryRankingPoints,
        eraQuestsCompleted: imperialState.sandboxQuestsCompleted || worldState.sovereignty.eraQuestsCompleted,
        wondersControlled: imperialState.sandboxWondersBuilt || worldState.sovereignty.wondersControlled,
        currentDay: worldState.day,
        hasTribeDome: imperialState.sandboxDomeActive || worldState.sovereignty.tribeDomeUnlocked,
        tribeLoyaltyStage: worldState.sovereignty.tribeLoyaltyStage,
        kingAlive: worldState.sovereignty.kingAlive,
        workforce: imperialState.workforceByFocus,
        unlockedMilitaryTechs: countUnlockedMilitaryTechs(imperialState.militaryTechTree),
        dragonChoice: imperialState.dragonChoice,
        senateSatisfaction: imperialState.senate.satisfaction,
        populationCurrent: Object.values(imperialState.populationByVillage).reduce((sum, value) => sum + Math.max(0, value), 0),
        populationCapacity: mergedVillages.reduce(
          (sum, village) => sum + Math.min(100, Math.max(0, Math.floor((village.buildingLevels.housing ?? 0) * 10))),
          0,
        ),
        employedPopulation: Object.values(imperialState.productionWorkersByVillage).reduce(
          (sum, jobs) => sum + Object.values(jobs).reduce((acc, value) => acc + value, 0),
          0,
        ) +
          Object.values(imperialState.jobsByVillage).reduce(
            (sum, jobs) => sum + Object.values(jobs).reduce((acc, value) => acc + value, 0),
            0,
          ),
        recruitedPopulation: Object.values(imperialState.recruitsByVillage).reduce(
          (sum, troops) => sum + Object.values(troops).reduce((acc, value) => acc + value, 0),
          0,
        ),
        troopPower: calculateTroopPower(imperialState.troops),
        defensePower: mergedVillages.reduce(
          (sum, village) =>
            sum +
            calculateDefensePower(
              imperialState.defenseRecruitsByVillage[village.id] ?? { guards: 0, archers: 0, ballistae: 0 },
            ),
          0,
        ),
      }),
    [
      heroCount,
      imperialState.dragonChoice,
      imperialState.militaryTechTree,
      imperialState.sandboxDomeActive,
      imperialState.sandboxQuestsCompleted,
      imperialState.sandboxWondersBuilt,
      imperialState.senate.satisfaction,
      imperialState.populationByVillage,
      imperialState.productionWorkersByVillage,
      imperialState.jobsByVillage,
      imperialState.recruitsByVillage,
      imperialState.troops,
      imperialState.defenseRecruitsByVillage,
      imperialState.workforceByFocus,
      mergedVillages,
      worldState.day,
      worldState.sovereignty.eraQuestsCompleted,
      worldState.sovereignty.kingAlive,
      worldState.sovereignty.militaryRankingPoints,
      worldState.sovereignty.tribeDomeUnlocked,
      worldState.sovereignty.tribeLoyaltyStage,
      worldState.sovereignty.wondersControlled,
    ],
  );

  const [uiSettings, setLocalUiSettings] = useState<UiSettings>(() => getUiSettings());
  const [portraitDevOpen, setPortraitDevOpen] = useState(false);
  const [fillingAi, setFillingAi] = useState(false);
  const [aiFillStatus, setAiFillStatus] = useState<string | null>(null);
  const [runtimeBusy, setRuntimeBusy] = useState<"start_now" | "schedule_midnight" | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<string | null>(null);
  const currentPreset = KING_PORTRAIT_PRESETS[selectedKing.id] ?? DEFAULT_KING_PORTRAIT_PRESET;
  const [portraitY, setPortraitY] = useState(currentPreset.y);
  const [portraitZoom, setPortraitZoom] = useState(currentPreset.zoom);

  useEffect(() => {
    setPortraitY(currentPreset.y);
    setPortraitZoom(currentPreset.zoom);
  }, [currentPreset.y, currentPreset.zoom, selectedKing.id]);

  useEffect(() => {
    setLocalUiSettings(getUiSettings());
  }, []);

  const toggleSetting = (key: keyof UiSettings) => {
    const next = { ...uiSettings, [key]: !uiSettings[key] };
    setLocalUiSettings(next);
    setUiSettings(next);
  };

  const portraitStyle = {
    backgroundImage: `linear-gradient(180deg, rgba(2,6,23,0.08), rgba(2,6,23,0.96)), url('${selectedKing.imageSrc}')`,
    backgroundPosition: `center ${portraitY}%`,
    backgroundSize: `${portraitZoom}%`,
  } as const;

  const portraitJson = JSON.stringify(
    {
      kingId: selectedKing.id,
      imageSrc: selectedKing.imageSrc,
      backgroundPositionY: `${portraitY}%`,
      backgroundSize: `${portraitZoom}%`,
    },
    null,
    2,
  );
  const participants = worldState.participants ?? [];
  const participantCount = participants.length;
  const participantTarget = worldState.playerCap ?? 25;
  const rankedParticipants = participants.slice(0, 10);
  const canFillAi = participantCount < participantTarget;

  const fillAiParticipants = async () => {
    setFillingAi(true);
    setAiFillStatus(null);
    try {
      const response = await fetch(`/api/worlds/${worldId}/participants/ai-fill`, { method: "POST" });
      const payload = (await response.json()) as { after?: number; created?: number; target?: number; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Nao foi possivel completar com IA.");
      }
      const target = payload.target ?? participantTarget;
      const message = `IA adicionada: ${payload.created ?? 0}. Total: ${payload.after ?? target}/${target}.`;
      setAiFillStatus(message);
      emitUiToast({ tone: "success", title: "Participantes completos", message });
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel completar com IA.";
      setAiFillStatus(message);
      emitUiToast({ tone: "error", title: "Falha ao preencher IA", message });
    } finally {
      setFillingAi(false);
    }
  };

  const updateRuntime = async (action: "start_now" | "schedule_midnight") => {
    setRuntimeBusy(action);
    setRuntimeStatus(null);
    try {
      const response = await fetch(`/api/worlds/${worldId}/runtime`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json()) as { startsAt?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Nao foi possivel atualizar o inicio.");
      }
      const label =
        action === "schedule_midnight"
          ? `Inicio agendado para ${payload.startsAt ? new Date(payload.startsAt).toLocaleString("pt-BR") : "00:00"}.`
          : "Mundo iniciado agora.";
      setRuntimeStatus(label);
      emitUiToast({
        tone: "success",
        title: action === "schedule_midnight" ? "Inicio agendado" : "Mundo iniciado",
        message: label,
      });
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel atualizar o inicio.";
      setRuntimeStatus(message);
      emitUiToast({ tone: "error", title: "Falha no comando GM", message });
    } finally {
      setRuntimeBusy(null);
    }
  };

  return (
    <section className="space-y-3">
      <article
        className="overflow-hidden rounded-[32px] border border-white/18 bg-slate-950/70 shadow-[0_24px_54px_rgba(2,6,23,0.48)]"
        style={portraitStyle}
      >
        <div className="min-h-[460px] p-4 pt-72">
          <div className="rounded-[22px] border border-white/14 bg-slate-950/45 p-2.5 backdrop-blur-md">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80">Rei da campanha</p>
            <div className="mt-1 flex items-end justify-between gap-2">
              <h1 className="text-[1.65rem] font-black leading-none text-slate-50">{kingName}</h1>
              <div className="rounded-xl border border-cyan-200/16 bg-cyan-400/8 px-2.5 py-1.5 text-center">
                <p className="text-[9px] uppercase tracking-[0.14em] text-slate-400">Score</p>
                <p className="text-lg font-black text-cyan-100">{sovereignty.total}</p>
              </div>
            </div>
            <p className="mt-1 text-[10px] leading-4 text-slate-200/90 line-clamp-1">{selectedKing.summary}</p>
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
              {selectedKing.traits.map((trait) => (
                <span
                  key={trait.label}
                  className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[8px] font-black ${
                    trait.tone === "bonus"
                      ? "border-emerald-300/35 bg-emerald-400/16 text-emerald-100"
                      : "border-rose-300/35 bg-rose-400/16 text-rose-100"
                  }`}
                >
                  {trait.label} {trait.value}
                </span>
              ))}
            </div>
          </div>
        </div>
      </article>

      <article className="kw-glass rounded-[28px] p-4" data-smoke="participants-ranking">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Editor de retrato (dev)</p>
          <button
            type="button"
            onClick={() => setPortraitDevOpen((value) => !value)}
            className="rounded-full border border-white/20 bg-white/8 px-2.5 py-1 text-[10px] font-black text-slate-100"
          >
            {portraitDevOpen ? "Ocultar" : "Abrir"}
          </button>
        </div>
        {portraitDevOpen ? (
          <div className="mt-3 grid gap-2">
            <label className="text-[11px] font-semibold text-slate-200">
              Posição Y: {portraitY}%
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={portraitY}
                onChange={(event) => setPortraitY(Number(event.target.value))}
                className="mt-1 w-full"
              />
            </label>
            <label className="text-[11px] font-semibold text-slate-200">
              Zoom: {portraitZoom}%
              <input
                type="range"
                min={80}
                max={150}
                step={1}
                value={portraitZoom}
                onChange={(event) => setPortraitZoom(Number(event.target.value))}
                className="mt-1 w-full"
              />
            </label>
            <div className="rounded-xl border border-white/14 bg-slate-950/62 p-2 text-[10px] leading-4 text-slate-200">
              <pre className="whitespace-pre-wrap break-words">{portraitJson}</pre>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(portraitJson).catch(() => undefined);
                }}
                className="rounded-xl border border-cyan-300/40 bg-cyan-500/16 px-3 py-2 text-[10px] font-black text-cyan-50"
              >
                Copiar JSON
              </button>
              <button
                type="button"
                onClick={() => {
                    setPortraitY(DEFAULT_KING_PORTRAIT_PRESET.y);
                    setPortraitZoom(DEFAULT_KING_PORTRAIT_PRESET.zoom);
                }}
                className="rounded-xl border border-white/20 bg-white/8 px-3 py-2 text-[10px] font-black text-slate-100"
              >
                Reset
              </button>
            </div>
          </div>
        ) : null}
      </article>

      <article className="kw-glass rounded-[28px] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Conta global</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-200/25 bg-cyan-500/12 text-cyan-100">
            <UserRound className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-black text-slate-50">{username}</h2>
            <p className="text-[12px] text-slate-300">Seu nick fixo fica fora da campanha.</p>
          </div>
        </div>
      </article>

      <article className="kw-glass rounded-[28px] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Participantes</p>
            <h2 className="mt-1 text-lg font-black text-slate-50">{participantCount}/{participantTarget} no mundo</h2>
            <p className="mt-1 text-[11px] leading-4 text-slate-300">Ranking de influencia e leitura diplomatica.</p>
          </div>
          <button
            type="button"
            data-smoke="fill-ai-participants"
            onClick={fillAiParticipants}
            disabled={!canFillAi || fillingAi}
            className="rounded-2xl border border-amber-300/35 bg-amber-400/14 px-3 py-2 text-[10px] font-black text-amber-50 disabled:opacity-45"
          >
            {fillingAi ? "Preenchendo..." : canFillAi ? `IA ate ${participantTarget}` : "Completo"}
          </button>
        </div>
        <div className="mt-3 grid gap-1.5">
          {rankedParticipants.map((participant, index) => (
            <div key={participant.id} className="rounded-2xl border border-white/12 bg-white/6 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-500">#{index + 1}</span>
                    <strong className="truncate text-[12px] text-slate-50">{participant.name}</strong>
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-slate-400">
                    {participant.kingName ?? "Coroa não escolhida"} · {participant.tribeName ?? "Sem clã"}
                    {participant.isAi ? " · IA" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${RELATION_CLASSES[participant.relation]}`}>
                    {RELATION_LABELS[participant.relation]}
                  </span>
                  <span className="min-w-[44px] text-right text-[12px] font-black text-cyan-100">{participant.influence}</span>
                </div>
              </div>
            </div>
          ))}
          {!rankedParticipants.length ? (
            <p className="rounded-2xl border border-white/12 bg-white/6 px-3 py-3 text-center text-[11px] text-slate-300">
              Nenhum participante registrado ainda.
            </p>
          ) : null}
        </div>
        {aiFillStatus ? <p className="mt-3 text-[11px] font-semibold text-slate-300">{aiFillStatus}</p> : null}
      </article>

      <article className="kw-glass rounded-[28px] p-4" data-smoke="gm-runtime-panel">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Comando GM</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-black text-slate-50">{worldState.phase}</h2>
            <p className="mt-1 text-[11px] leading-4 text-slate-300">Abre a temporada manualmente ou trava a largada para a proxima meia-noite.</p>
          </div>
          <span className="rounded-full border border-white/14 bg-white/7 px-2 py-1 text-[10px] font-black text-slate-100">Dia {worldState.day}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            data-smoke="runtime-start-now"
            onClick={() => updateRuntime("start_now")}
            disabled={Boolean(runtimeBusy)}
            className="rounded-2xl border border-emerald-300/35 bg-emerald-400/14 px-3 py-2.5 text-[11px] font-black text-emerald-50 disabled:opacity-45"
          >
            {runtimeBusy === "start_now" ? "Iniciando..." : "Iniciar agora"}
          </button>
          <button
            type="button"
            data-smoke="runtime-schedule-midnight"
            onClick={() => updateRuntime("schedule_midnight")}
            disabled={Boolean(runtimeBusy)}
            className="rounded-2xl border border-cyan-300/35 bg-cyan-400/14 px-3 py-2.5 text-[11px] font-black text-cyan-50 disabled:opacity-45"
          >
            {runtimeBusy === "schedule_midnight" ? "Agendando..." : "Proxima 00:00"}
          </button>
        </div>
        {runtimeStatus ? <p className="mt-3 text-[11px] font-semibold text-slate-300">{runtimeStatus}</p> : null}
      </article>

      <article className="kw-glass rounded-[28px] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Settings</p>
        <div className="mt-3 grid gap-2">
          {[
            { key: "uiSoundEnabled", label: "Sons UI" },
            { key: "musicEnabled", label: "Música" },
            { key: "hapticsEnabled", label: "Haptic" },
            { key: "silentMode", label: "Modo silencioso" },
          ].map((item) => {
            const enabled = uiSettings[item.key as keyof UiSettings];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => toggleSetting(item.key as keyof UiSettings)}
                className="flex items-center justify-between rounded-2xl border border-white/14 bg-white/6 px-3 py-2.5 text-left"
              >
                <span className="text-[12px] font-semibold text-slate-100">{item.label}</span>
                <span
                  className={`inline-flex w-[62px] items-center rounded-full border px-1 py-1 transition ${
                    enabled
                      ? "border-emerald-300/40 bg-emerald-500/22 justify-end"
                      : "border-white/20 bg-slate-800/70 justify-start"
                  }`}
                >
                  <span className="h-5 w-5 rounded-full bg-white shadow-[0_3px_10px_rgba(2,6,23,0.35)]" />
                </span>
              </button>
            );
          })}
        </div>
      </article>
    </section>
  );
}
