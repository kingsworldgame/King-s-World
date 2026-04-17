"use client";

import { BookOpen, Castle, FlaskConical, Globe2, Home, Radar } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";

import { emitUiFeedback } from "@/lib/ui-feedback";

const tabs = [
  { key: "empire", label: "Imperio", icon: Castle, center: false },
  { key: "operations", label: "Operacoes", icon: FlaskConical, center: false },
  { key: "base", label: "A Base", icon: Home, center: true },
  { key: "board", label: "Mundo", icon: Globe2, center: false },
  { key: "intelligence", label: "Inteligencia", icon: Radar, center: false },
  { key: "guide", label: "Guia", icon: BookOpen, center: false },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export function BottomNavigation({
  worldId,
  activeTab,
  villageId,
  evolutionMode,
}: {
  worldId: string;
  activeTab: TabKey;
  villageId: string;
  evolutionMode?: string | null;
}) {
  const router = useRouter();
  const [optimisticTab, setOptimisticTab] = useState<TabKey>(activeTab);

  useEffect(() => {
    setOptimisticTab(activeTab);
  }, [activeTab]);

  const hrefByTab = useMemo(() => {
    const entries = new Map<TabKey, string>();
    for (const tab of tabs) {
      const params = new URLSearchParams();
      params.set("v", villageId);
      if (evolutionMode) {
        params.set("m", evolutionMode);
      }
      entries.set(tab.key, `/world/${worldId}/${tab.key}?${params.toString()}`);
    }
    return entries;
  }, [evolutionMode, villageId, worldId]);

  useEffect(() => {
    for (const tab of tabs) {
      const href = hrefByTab.get(tab.key);
      if (href) {
        router.prefetch(href);
      }
    }
  }, [hrefByTab, router]);

  const navigate = (tabKey: TabKey) => {
    const href = hrefByTab.get(tabKey);
    if (!href) {
      return;
    }

    setOptimisticTab(tabKey);
    emitUiFeedback(tabKey === activeTab ? "tap" : "route", tabKey === activeTab ? "light" : "medium");
    if (tabKey === activeTab) {
      return;
    }

    startTransition(() => {
      router.push(href, { scroll: false });
    });
  };

  return (
    <nav
      aria-label="Navegacao principal do mundo"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(4px+env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-[22px] border border-white/30 bg-white/12 px-1.5 py-1 shadow-[0_22px_46px_rgba(2,6,23,0.5)] backdrop-blur-xl">
          <div className="grid grid-cols-6 items-center gap-0.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.key === optimisticTab;

              if (tab.center) {
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => navigate(tab.key)}
                    aria-current={isActive ? "page" : undefined}
                    className={`mx-auto flex h-[50px] w-[50px] flex-col items-center justify-center rounded-full border-[2px] border-slate-100/90 shadow-2xl transition active:scale-95 ${
                      isActive ? "bg-blue-600 text-white" : "bg-blue-500 text-white/90"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="mt-0.5 text-[8px] font-bold tracking-[0.02em]">A BASE</span>
                  </button>
                );
              }

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => navigate(tab.key)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex min-w-[50px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[8px] font-semibold transition active:scale-95 ${
                    isActive
                      ? "bg-white/15 text-sky-300 shadow-lg"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  <span className="leading-none">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
