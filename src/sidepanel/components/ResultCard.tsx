import type { ReactNode } from "react";

interface ResultCardProps {
  title: string;
  children: ReactNode;
}

export function ResultCard({ title, children }: ResultCardProps) {
  return (
    <section className="result-card">
      <header className="result-card__header">
        <h3>{title}</h3>
      </header>
      <div className="result-card__body">{children}</div>
    </section>
  );
}
