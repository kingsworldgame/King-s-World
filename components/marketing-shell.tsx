import type { ReactNode } from "react";

export function MarketingShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="marketing-shell">
      <section className="marketing-hero">
        <p className="eyebrow">KingsWorld</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </section>
      <section className="marketing-panel">{children}</section>
    </main>
  );
}
