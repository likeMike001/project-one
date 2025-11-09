"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import HeroSection from "@/components/HeroSection";
import PreferencePanel from "@/components/PreferencePanel";
import StatHighlights from "@/components/StatHighlights";
import ChartsSection from "@/components/ChartsSection";
import TrustVerificationSection from "@/components/TrustVerificationSection";
import { mockPriceSeries, mockSentiment } from "@/lib/constants";
import { useTrustDatasets } from "@/hooks/useTrustDatasets";
import {
  ClusterInsight,
  FocusMode,
  Recommendation,
} from "@/types";

const MODEL_API_URL =
  process.env.NEXT_PUBLIC_MODEL_API_URL ?? "http://localhost:8001";
const USE_DEMO_SIGNALS =
  (process.env.NEXT_PUBLIC_DEMO_SIGNALS ?? "false").toLowerCase() === "true";
const DEMO_WEIGHT = Number(process.env.NEXT_PUBLIC_DEMO_WEIGHT ?? 65);

const snapWeight = (value: number) => (value < 50 ? 50 : 60);

const DEMO_RECOMMENDATIONS: Recommendation[] = [
  {
    action: "restake",
    probability: 0.58,
    rationale: "Price-weighted snapshot favours compounding rewards.",
  },
  {
    action: "stake",
    probability: 0.29,
    rationale: "Neutral stance keeps capital deployed in baseline pools.",
  },
  {
    action: "liquid_stake",
    probability: 0.13,
    rationale: "Liquidity optionality remains a secondary hedge.",
  },
];

const DEMO_CLUSTER: ClusterInsight = {
  id: 0,
  label: "Restake skew",
  description:
    "APR momentum trending higher alongside elevated withdrawer counts.",
  drivers: [
    "Daily APR sits near local highs with positive netflows.",
    "Depositors outpace withdrawers after semantic boost.",
  ],
  metrics: {
    daily_apr: 0.0259,
    withdraw: -3200,
    deposit: 12500,
    daily_netflow: 9300,
    withdrawers: 58,
    depositors: 72,
  },
};

const DEFAULT_NARRATIVE =
  "Models are syncing signals—adjust the slider to see how focus shifts recommendations.";
const DEMO_NARRATIVE =
  "Claude notes a restake tilt with liquidity hedges kept light; watch deposits outpacing withdrawals.";

const formatMetricValue = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  if (Math.abs(value) >= 1) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return value.toFixed(4);
};

const formatPercent = (value: number | null | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  return `${(value * 100).toFixed(1)}%`;
};

export default function Home() {
  const [focus, setFocus] = useState<FocusMode>("price");
  const [weight, setWeight] = useState(DEMO_WEIGHT);
  const [effectiveBias, setEffectiveBias] = useState(snapWeight(DEMO_WEIGHT));
  const [wallet, setWallet] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [recStatus, setRecStatus] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [clusterInsight, setClusterInsight] =
    useState<ClusterInsight | null>(null);
  const [modelMessage, setModelMessage] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [narrativeCopy, setNarrativeCopy] = useState<string>(
    DEFAULT_NARRATIVE,
  );

  const heroRef = useRef<HTMLDivElement | null>(null);
  const highlightRef = useRef<HTMLSpanElement | null>(null);
  const cardRefs = useRef<HTMLDivElement[]>([]);
  const chartRefs = useRef<HTMLDivElement[]>([]);
  const inferenceController = useRef<AbortController | null>(null);
  const walletRef = useRef("");
  const weightRef = useRef(effectiveBias);

  const { datasets: trustDatasets, status: trustStatus, trustApiUrl } =
    useTrustDatasets();

  useEffect(() => {
    walletRef.current = wallet;
  }, [wallet]);

  useEffect(() => {
    weightRef.current = effectiveBias;
  }, [effectiveBias]);

  useEffect(() => () => inferenceController.current?.abort(), []);

  useEffect(() => {
    const id = requestAnimationFrame(() => setHydrated(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!heroRef.current) return;

    const ctx = gsap.context(() => {
      gsap.from(".hero-copy", {
        opacity: 0,
        y: 30,
        duration: 0.8,
        ease: "power3.out",
      });

      gsap.from(cardRefs.current, {
        opacity: 0,
        y: 25,
        duration: 0.6,
        stagger: 0.1,
        delay: 0.2,
        ease: "power3.out",
      });

      gsap.from(chartRefs.current, {
        opacity: 0,
        y: 40,
        duration: 0.7,
        stagger: 0.15,
        delay: 0.3,
        ease: "power3.out",
      });
    }, heroRef);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!highlightRef.current) return;
    gsap.to(highlightRef.current, {
      xPercent: focus === "price" ? 0 : 100,
      duration: 0.35,
      ease: "power2.out",
    });
  }, [focus]);

  const handleFocusChange = (mode: FocusMode) => {
    setFocus(mode);
    setWeight(mode === "price" ? 75 : 25);
  };

  const handleSliderInput = (value: number) => {
    setWeight(value);
    const snapped = snapWeight(value);
    setFocus(snapped >= 50 ? "price" : "sentiment");
    setEffectiveBias(snapped);
    console.log("Preference updated", {
      sliderValue: value,
      appliedPriceWeight: snapped / 100,
    });
  };

  const confidenceScore = useMemo(() => {
    const priceBias = weight / 100;
    const sentimentBias = 1 - priceBias;
    const base = focus === "price" ? 0.62 : 0.55;
    return Math.round((base + priceBias * 0.25 + sentimentBias * 0.2) * 100);
  }, [focus, weight]);

  const tiltCopy =
    focus === "price"
      ? "ML is prioritizing on-chain microstructure and order flow."
      : "LLM-derived tone will steer allocations for the next window.";

  const runInference = useCallback(
    async ({
      trigger = "manual",
      bias,
      includeWallet = false,
    }: {
      trigger?: "auto" | "manual";
      bias?: number;
      includeWallet?: boolean;
    }) => {
      if (USE_DEMO_SIGNALS) {
        setRecommendations(DEMO_RECOMMENDATIONS);
        setClusterInsight(DEMO_CLUSTER);
        setNarrativeCopy(DEMO_NARRATIVE);
        setLastRunAt(new Date().toISOString());
        return;
      }

      if (recStatus === "loading" && trigger === "auto") return;

      const controller = new AbortController();
      inferenceController.current?.abort();
      inferenceController.current = controller;

      try {
        setRecStatus("loading");
        const response = await fetch(`${MODEL_API_URL}/signals`, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            price_weight: (bias ?? effectiveBias) / 100,
            sentiment_weight: 1 - (bias ?? effectiveBias) / 100,
            wallet: includeWallet ? walletRef.current : undefined,
          }),
        });

        if (!response.ok) {
          throw new Error(`Model API error: ${response.status}`);
        }

        const payload = await response.json();
        setRecommendations(payload.recommendations ?? []);
        setClusterInsight(payload.cluster ?? null);
        setModelMessage(payload.message ?? null);
        setNarrativeCopy(payload.narrative ?? DEFAULT_NARRATIVE);
        setLastRunAt(payload.generated_at ?? new Date().toISOString());
        setRecStatus("idle");
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.warn("Falling back to demo snapshot while the model API is unreachable.");
        setRecommendations(DEMO_RECOMMENDATIONS);
        setClusterInsight(DEMO_CLUSTER);
        setModelMessage(
          "Falling back to demo snapshot while the model API is unreachable.",
        );
        setLastRunAt(new Date().toISOString());
        setNarrativeCopy(DEFAULT_NARRATIVE);
        setRecStatus("error");
      }
    },
    [effectiveBias, recStatus],
  );

  useEffect(() => {
    const debounce = setTimeout(() => {
      runInference({
        trigger: USE_DEMO_SIGNALS ? "manual" : "auto",
        bias: effectiveBias,
      });
    }, USE_DEMO_SIGNALS ? 0 : 600);

    return () => clearTimeout(debounce);
  }, [effectiveBias, runInference]);

  const handleRunSignal = (includeWallet = false) =>
    runInference({ trigger: "manual", includeWallet });

  const statCards: StatCard[] = [
    { label: "Projected Move", value: "+5.6%", meta: "24h blended target" },
    { label: "Sentiment Tilt", value: "+0.42", meta: "FinBERT score" },
    {
      label: "Confidence",
      value: `${confidenceScore}%`,
      meta: `${weight}% price · ${100 - weight}% sentiment`,
    },
  ];

  const showCharts = hydrated;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <main
        ref={heroRef}
        className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12 lg:py-16"
      >
        <HeroSection />

        <PreferencePanel
          focus={focus}
          weight={weight}
          tiltCopy={tiltCopy}
          wallet={wallet}
          recStatus={recStatus}
          recommendations={recommendations}
          cluster={clusterInsight}
          modelMessage={modelMessage}
          lastRunAt={lastRunAt}
          narrativeCopy={narrativeCopy}
          effectiveBias={effectiveBias}
          highlightRef={highlightRef}
          useDemoSignals={USE_DEMO_SIGNALS}
          onFocusChange={handleFocusChange}
          onSliderInput={handleSliderInput}
          onWalletChange={setWallet}
          onRunSignal={handleRunSignal}
          formatMetricValue={formatMetricValue}
          formatPercent={formatPercent}
        />

        <StatHighlights cards={statCards} cardRefs={cardRefs} />

        <ChartsSection
          priceSeries={mockPriceSeries}
          sentimentSeries={mockSentiment}
          showCharts={showCharts}
          chartRefs={chartRefs}
        />

        <TrustVerificationSection
          datasets={trustDatasets}
          status={trustStatus}
          trustApiUrl={trustApiUrl}
        />

        <section className="rounded-3xl border border-white/10 bg-gradient-to-r from-slate-900/70 to-black/50 p-6 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
                Pipeline preview
              </p>
              <h3 className="text-2xl font-semibold text-white">
                Synthetic news → sentiment → feature store → PKL predictions
              </h3>
              <p className="mt-2 text-sm text-slate-300">
                Once the random-forest + FinBERT stack is promoted, the PKL
                artifact will plug directly into this UI. Today’s view is mocked
                data so we can finalize layout and interactions.
              </p>
            </div>
            <button className="rounded-2xl border border-emerald-400/50 px-6 py-3 text-sm font-semibold text-emerald-300 transition hover:border-emerald-300 hover:text-white">
              View integration checklist
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
