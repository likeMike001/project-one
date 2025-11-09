import { useEffect, useState } from "react";
import { TrustDataset, TrustStatus } from "@/types";

const TRUST_API_URL =
  process.env.NEXT_PUBLIC_TRUST_API_URL ?? "http://localhost:8000";

export function useTrustDatasets() {
  const [datasets, setDatasets] = useState<TrustDataset[]>([]);
  const [status, setStatus] = useState<TrustStatus>("idle");

  useEffect(() => {
    let cancelled = false;

    async function fetchTrust() {
      try {
        setStatus("loading");
        const response = await fetch(`${TRUST_API_URL}/trust/datasets`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Trust API error: ${response.status}`);
        }
        const payload = await response.json();
        if (!cancelled) {
          setDatasets(payload.datasets ?? []);
          setStatus("idle");
        }
      } catch (error) {
        console.error("Failed to load trust datasets", error);
        if (!cancelled) {
          setStatus("error");
        }
      }
    }

    fetchTrust();
    return () => {
      cancelled = true;
    };
  }, []);

  return { datasets, status, trustApiUrl: TRUST_API_URL };
}
