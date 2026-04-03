import { useEffect, useState } from 'react';

/** Mock INR per 1 unit of foreign currency (base anchors; jittered every tick). */
export const EXCHANGE_BASE_INR_PER_UNIT: Record<'USD' | 'EUR' | 'CNY' | 'GBP', number> = {
  USD: 83.5,
  EUR: 90.2,
  CNY: 11.6,
  GBP: 105.8,
};

export type FxCode = keyof typeof EXCHANGE_BASE_INR_PER_UNIT;

/**
 * Live mock FX: base rates with ±0.5% random walk step every 30s (resampled from base each tick).
 */
export function useLiveExchangeRates(): Record<FxCode, number> {
  const [rates, setRates] = useState<Record<FxCode, number>>(() => ({ ...EXCHANGE_BASE_INR_PER_UNIT }));

  useEffect(() => {
    const jitter = () => {
      setRates(() => {
        const next = { ...EXCHANGE_BASE_INR_PER_UNIT } as Record<FxCode, number>;
        (Object.keys(EXCHANGE_BASE_INR_PER_UNIT) as FxCode[]).forEach((k) => {
          const delta = (Math.random() - 0.5) * 0.01; // ±0.5%
          next[k] = EXCHANGE_BASE_INR_PER_UNIT[k] * (1 + delta);
        });
        return next;
      });
    };
    jitter();
    const id = window.setInterval(jitter, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return rates;
}
