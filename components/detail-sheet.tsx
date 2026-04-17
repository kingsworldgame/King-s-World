"use client";

import { X } from "lucide-react";

import { emitUiFeedback } from "@/lib/ui-feedback";

type DetailMetric = {
  label: string;
  value: string;
  note: string;
};

type DetailBreakdownRow = {
  label: string;
  current: number | string;
  max?: number | string;
  note: string;
};

export type DetailSheetContent = {
  eyebrow?: string;
  title: string;
  description: string;
  formula?: string;
  valueLabel?: string;
  progressPct?: number;
  color?: "blue" | "green" | "red";
  metrics?: DetailMetric[];
  breakdown?: DetailBreakdownRow[];
  missing?: string[];
};

function formatRowValue(current: number | string, max?: number | string) {
  if (typeof max === "undefined") {
    return `${current}`;
  }
  return `${current}/${max}`;
}

function resolveBarTone(color: DetailSheetContent["color"]) {
  if (color === "green") return "kw-progress__bar--green";
  if (color === "red") return "kw-progress__bar--red";
  return "kw-progress__bar--blue";
}

export function DetailSheet({
  open,
  content,
  onClose,
}: {
  open: boolean;
  content: DetailSheetContent | null;
  onClose: () => void;
}) {
  if (!open || !content) {
    return null;
  }

  const handleClose = () => {
    emitUiFeedback("close", "light");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        aria-label="Fechar detalhes"
        className="absolute inset-0 bg-slate-950/72 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+20px)] top-[calc(env(safe-area-inset-top)+72px)] mx-auto flex w-full max-w-md">
        <div className="kw-glass flex h-full w-full flex-col rounded-[28px] p-3 text-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {content.eyebrow ?? "Detalhe"}
              </p>
              <h3 className="kw-title text-lg">{content.title}</h3>
              <p className="mt-1 text-[11px] leading-5 text-slate-300">{content.description}</p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/8 text-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1">
            {content.formula ? (
              <div className="rounded-2xl kw-glass-soft p-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Formula</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-200">{content.formula}</p>
              </div>
            ) : null}

            {typeof content.progressPct === "number" || content.valueLabel ? (
              <div className="rounded-2xl kw-glass-soft p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="kw-card-title">{content.valueLabel ?? "Estado atual"}</p>
                  {typeof content.progressPct === "number" ? (
                    <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-bold text-slate-200">
                      {Math.round(content.progressPct)}%
                    </span>
                  ) : null}
                </div>
                {typeof content.progressPct === "number" ? (
                  <div className="kw-progress mt-2">
                    <div
                      className={`kw-progress__bar ${resolveBarTone(content.color)}`}
                      style={{ width: `${Math.max(0, Math.min(100, content.progressPct))}%` }}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {content.metrics?.length ? (
              <div className="grid grid-cols-2 gap-2">
                {content.metrics.map((metric) => (
                  <div key={metric.label} className="rounded-2xl kw-glass-soft p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{metric.label}</p>
                    <p className="mt-1 text-base font-bold text-slate-100">{metric.value}</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-300">{metric.note}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {content.breakdown?.length ? (
              <div className="rounded-2xl kw-glass-soft p-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Composicao</p>
                <div className="mt-2 space-y-2">
                  {content.breakdown.map((row) => {
                    const currentValue = typeof row.current === "number" ? row.current : null;
                    const maxValue = typeof row.max === "number" ? row.max : null;
                    const canBar = currentValue !== null && maxValue !== null && maxValue > 0;
                    const pct = canBar ? (currentValue / maxValue) * 100 : null;
                    return (
                      <div key={`${row.label}-${row.note}`} className="rounded-xl border border-white/10 bg-white/5 px-2 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold text-slate-100">{row.label}</p>
                          <span className="text-[10px] font-bold text-slate-200">{formatRowValue(row.current, row.max)}</span>
                        </div>
                        {typeof pct === "number" ? (
                          <div className="kw-progress mt-1.5">
                            <div
                              className={`kw-progress__bar ${resolveBarTone(content.color)}`}
                              style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                            />
                          </div>
                        ) : null}
                        <p className="mt-1 text-[11px] leading-5 text-slate-300">{row.note}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {content.missing?.length ? (
              <div className="rounded-2xl kw-glass-soft p-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">O que falta</p>
                <div className="mt-2 space-y-1.5">
                  {content.missing.map((item) => (
                    <p key={item} className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] leading-5 text-slate-200">
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
