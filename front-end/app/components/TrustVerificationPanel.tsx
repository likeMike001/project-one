"use client";

import { TrustDataset } from "../types/dashboard";

type TrustVerificationPanelProps = {
  status: "idle" | "loading" | "error";
  datasets: TrustDataset[];
  trustApiUrl: string;
};

export function TrustVerificationPanel({
  status,
  datasets,
  trustApiUrl,
}: TrustVerificationPanelProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
            Trust verification
          </p>
          <h3 className="text-2xl font-semibold text-white">
            EigenLayer-style proofs for static datasets
          </h3>
          <p className="mt-2 text-sm text-slate-300">
            Hashes are recomputed on the trust service and exposed via the
            trust_layer API. When models go live, their artifacts drop into the
            same pipeline.
          </p>
        </div>
        <span className="rounded-2xl border border-emerald-400/50 px-6 py-3 text-sm font-semibold text-emerald-300">
          {status === "loading"
            ? "Refreshing proofs..."
            : status === "error"
            ? "Verification unavailable"
            : "Verified by EigenLayer"}
        </span>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {status === "loading" && (
          <div className="h-32 animate-pulse rounded-2xl border border-white/10 bg-slate-800/40" />
        )}
        {status === "error" && (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-950/40 p-4 text-sm text-rose-200">
            Unable to reach the trust API. Is the FastAPI service running on{" "}
            <code>{trustApiUrl}</code>?
          </div>
        )}
        {status !== "error" &&
          datasets.map((dataset) => {
            const verified = dataset.status === "ok";
            return (
              <div
                key={dataset.id}
                className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-slate-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      {dataset.id}
                    </p>
                    <p className="text-base font-semibold text-white">
                      {dataset.label}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${
                      verified
                        ? "border border-emerald-400/50 text-emerald-200"
                        : "border border-rose-400/50 text-rose-200"
                    }`}
                  >
                    {verified ? "Verified" : "Missing"}
                  </span>
                </div>
                <p className="mt-3 truncate text-xs font-mono text-slate-400">
                  {dataset.sha256 ?? "n/a"}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span>
                    {dataset.last_verified_at
                      ? new Date(dataset.last_verified_at).toLocaleString()
                      : "n/a"}
                  </span>
                  {dataset.zkp_simulation?.status && (
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-emerald-200">
                      ZKP: {dataset.zkp_simulation.status}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </section>
  );
}
