import { MutableRefObject } from "react";

export type StatCard = {
  label: string;
  value: string;
  meta: string;
};

type StatHighlightsProps = {
  cards: StatCard[];
  cardRefs: MutableRefObject<HTMLDivElement[]>;
};

const StatHighlights = ({ cards, cardRefs }: StatHighlightsProps) => (
  <section className="grid gap-6 lg:grid-cols-3">
    {cards.map((card, idx) => (
      <div
        key={card.label}
        ref={(el) => {
          if (el) cardRefs.current[idx] = el;
        }}
        className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur"
      >
        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
          {card.label}
        </p>
        <p className="mt-3 text-4xl font-semibold text-white">{card.value}</p>
        <p className="mt-1 text-sm text-slate-300">{card.meta}</p>
      </div>
    ))}
  </section>
);

export default StatHighlights;
