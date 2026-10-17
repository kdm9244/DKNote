import { useEffect, useState } from "react";
import api from "../api/client";
import { normalizeAssetRate } from "./assetSummary";
export function useAssetRates(currencies) {
  const key = currencies
    .filter((c) => c !== "KRW")
    .sort()
    .join("|");
  const [rates, setRates] = useState({});
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const foreign = key ? key.split("|") : [];
    if (!foreign.length) {
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      const result = await Promise.allSettled(
        foreign.map((c) =>
          api.get("/api/ai/exchange-rate", {
            params: { base: c, quote: "KRW" },
          }),
        ),
      );
      if (!active) return;
      const next = {};
      result.forEach((r, i) => {
        if (r.status === "fulfilled") {
          const quote = r.value.data,
            rate = normalizeAssetRate(quote, foreign[i]);
          if (rate)
            next[foreign[i]] = {
              rate,
              provider: quote.provider,
              updatedAt: quote.updatedAt,
            };
        }
      });
      setRates(next);
      setLoading(false);
    };
    load();
    const timer = setInterval(load, 300000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [key, revision]);
  return { rates, loading, refresh: () => setRevision((v) => v + 1) };
}
