"use client";

type HeroSectionProps = {
  narrativeCopy: string;
  effectiveBias: number;
};

export function HeroSection({
  narrativeCopy,
  effectiveBias,
}: HeroSectionProps) {
  return (
    <section className="hero-copy rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md lg:p-12">
      <p className="mb-4 text-sm uppercase tracking-[0.4em] text-slate-300">
        Ethereum Alpha Console
      </p>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
            Blend price predictions with semantic intelligence in real time.
          </h1>
          <p className="text-lg text-slate-200 lg:max-w-2xl">
            Nudge the slider toward pure quant or narrative-driven signals, then
            review how the model reconciles the two -- complete with live
            projections, tone analysis, and confidence bands.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 px-6 py-5">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">
            Active window
          </p>
          <p className="text-2xl font-semibold">LSTM x FinBERT v0.3</p>
          <p className="text-xs text-slate-300">Next refresh in 17 min</p>
        </div>
      </div>
    </section>
  );
}
