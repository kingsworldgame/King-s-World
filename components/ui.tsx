import type { ReactNode } from "react";

export function SectionCard({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <section className="section-card">
      <div className="section-card__header">
        {eyebrow ? <span className="section-card__eyebrow">{eyebrow}</span> : null}
        <h2>{title}</h2>
      </div>
      <div className="section-card__body">{children}</div>
    </section>
  );
}

export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "danger" | "warning" | "success" }) {
  return <span className={`status-badge status-badge--${tone}`}>{label}</span>;
}
