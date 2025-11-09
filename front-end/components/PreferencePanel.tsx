import { MutableRefObject } from "react";
import { ClusterInsight, FocusMode, Recommendation } from "@/types";

export type PreferencePanelProps = {
  focus: FocusMode;
  weight: number;
  tiltCopy: string;
  wallet: string;
  recStatus: "idle" | "loading" | "error";
  recommendations: Recommendation[];
  cluster: ClusterInsight | null;
  modelMessage: string | null;
  lastRunAt: string | null;
  narrativeCopy: string;
  effectiveBias: number;
  highlightRef: MutableRefObject<HTMLSpanElement | null>;
  useDemoSignals: boolean;
  onFocusChange: (mode: FocusMode) => void;
  onSliderInput: (value: number) => void;
  onWalletChange: (value: string) => void;
  onRunSignal: (includeWallet?: boolean) => void;
  formatMetricValue: (value: number | null | undefined) => string;
  formatPercent: (value: number | null | undefined) => string;
};

const PreferencePanel = ({
  focus,
  weight,
  tiltCopy,
  wallet,
  recStatus,
  recommendations,
  cluster,
  modelMessage,
  lastRunAt,
  narrativeCopy,
  effectiveBias,
  highlightRef,
  useDemoSignals,
  onFocusChange,
  onSliderInput,
  onWalletChange,
  onRunSignal,
  formatMetricValue,
  formatPercent,
}: PreferencePanelProps) => {
  return (
    <section className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Preference Control</h2>
            <span className="text-sm text-slate-300">{tiltCopy}</span>
          </div>
          <div className="relative grid grid-cols-2 rounded-2xl border border-white/10 bg-black/30 p-1 text-sm font-medium text-slate-300">
            <span
              ref={highlightRef}
              className="absolute inset-y-1 left-1 z-0 w-1/2 rounded-xl bg-gradient-to-r from-emerald-400/80 to-cyan-400/80 mix-blend-screen"
            />
            {["price", "sentiment"].map((mode) => (
              <button
                key={mode}
                className={`z-10 rounded-xl px-4 py-2 transition-colors ${
                  focus === mode ? "text-black" : "text-slate-300"
                }`}
                onClick={() => onFocusChange(mode as FocusMode)}
              >
                {mode === "price" ? "Price precision" : "Semantic context"}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <label className="flex items-center justify-between text-sm text-slate-300">
              <span>Weight toward price action</span>
              <span className="font-semibold text-white">{weight}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={weight}
              onChange={(event) => onSliderInput(Number(event.target.value))}
              className="h-1 w-full appearance-none rounded-full bg-slate-700 accent-emerald-400"
            />
          </div>
        </div>
        <div className="mt-6 rounded-2xl bg-black/30 p-4">
          <label className="text-sm text-slate-300">Optional wallet signal</label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input
              value={wallet}
              onChange={(event) => onWalletChange(event.target.value)}
              placeholder="0x… (coming soon to modeling layer)"
              className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400/70"
              disabled={useDemoSignals}
            />
            <button
              onClick={() => onRunSignal(true)}
              disabled={recStatus === "loading" || useDemoSignals}
              className={`rounded-xl px-6 py-3 text-sm font-semibold shadow-2xl shadow-emerald-500/30 transition ${
                recStatus === "loading"
                  ? "cursor-not-allowed bg-slate-600 text-slate-300"
                  : "bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-900"
              }`}
            >
              {recStatus === "loading" ? "Updating…" : "Run signal"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Wallet routing remains optional; we’ll pass it to the modeling layer
            when available.
          </p>
          {modelMessage && (
            <p className="mt-3 text-xs text-slate-400">
              {recStatus === "error" ? "⚠️ " : "ℹ️ "}
              {modelMessage}
            </p>
          )}
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.4em] text-slate-400">
              <span>Action stack</span>
              {lastRunAt && (
                <span className="text-[10px] normal-case text-slate-500">
                  {new Date(lastRunAt).toLocaleTimeString()}
                </span>
              )}
            </div>
            <div className="mt-3 space-y-3">
              {recStatus === "loading" && (
                <div className="space-y-2">
                  {[0, 1, 2].map((idx) => (
                    <div key={idx} className="h-10 animate-pulse rounded-xl bg-slate-800/40" />
                  ))}
                </div>
              )}
              {recStatus !== "loading" && recommendations.length === 0 && (
                <p className="text-sm text-slate-400">
                  No actions yet—adjust the slider or run the signal to see
                  recommendations.
                </p>
              )}
              {recStatus !== "loading" &&
                recommendations.map((rec) => (
                  <div
                    key={rec.action}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-3"
                  >
                    <div>
                      <p className="text-xs uppercase tracking-[0.5em] text-slate-500">
                        {rec.action}
                      </p>
                      <p className="text-sm text-slate-300">{rec.rationale}</p>
                    </div>
                    <span className="text-lg font-semibold text-white">
                      {(rec.probability * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
              Cluster context
            </p>
            {cluster ? (
              <div className="mt-3 space-y-3 text-sm text-slate-300">
                <div>
                  <p className="text-lg font-semibold text-white">
                    {cluster.label ?? `Cluster ${cluster.id}`}
                  </p>
                  <p className="text-slate-400">{cluster.description}</p>
                </div>
                {cluster.drivers && (
                  <ul className="list-disc space-y-2 pl-6 text-xs text-slate-400">
                    {cluster.drivers.map((driver) => (
                      <li key={driver}>{driver}</li>
                    ))}
                  </ul>
                )}
                <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs">
                  {cluster.metrics &&
                    Object.entries(cluster.metrics).map(([key, value]) => (
                      <div className="flex justify-between" key={key}>
                        <span className="uppercase tracking-[0.3em] text-slate-500">
                          {key}
                        </span>
                        <span className="text-white">
                          {key.includes("apr") || key.includes("flow")
                            ? formatPercent(value)
                            : formatMetricValue(value)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">
                Adjust the slider or run the signal to classify the current
                regime.
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-black/60 to-slate-900/40 p-6">
        <h3 className="text-sm uppercase tracking-[0.4em] text-slate-400">
          Live takeaways
        </h3>
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-slate-200">
          <p>{narrativeCopy}</p>
        </div>
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">
            Model status
          </p>
          <p className="mt-2 text-lg font-semibold text-white">
            Streaming synthetic news + CoinGecko spot feed
          </p>
          <p className="mt-1 text-slate-400">
            Last Claude batch · 32 articles · 58% positive tone
          </p>
          <p className="mt-4 text-xs text-slate-500">
            Slider bias locked at {effectiveBias}% price · {100 - effectiveBias}%
            sentiment.
          </p>
        </div>
      </div>
    </section>
  );
};

export default PreferencePanel;
