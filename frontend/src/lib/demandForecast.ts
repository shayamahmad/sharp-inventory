/**
 * 30-day demand forecast from salesLast30: daily buckets + simple exponential smoothing (SES).
 * Future bands widen with horizon (sqrt-style growth × residual scale).
 */

export const SES_ALPHA = 0.3;

/** Deterministic daily splits that sum to salesLast30 (stable per product id). */
export function dailyDemandBuckets(salesLast30: number, seed: string): number[] {
  if (salesLast30 <= 0) return Array(30).fill(0);
  const raw: number[] = [];
  for (let d = 0; d < 30; d++) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i) + d * 17) >>> 0;
    const w = 0.65 + (h % 100) / 200 + 0.25 * Math.sin((d / 30) * Math.PI * 2);
    raw.push(Math.max(0.05, w));
  }
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => (salesLast30 * w) / sum);
}

export function exponentialSmoothing(values: number[], alpha: number): number[] {
  if (values.length === 0) return [];
  const s: number[] = [values[0]!];
  for (let t = 1; t < values.length; t++) {
    s.push(alpha * values[t]! + (1 - alpha) * s[t - 1]!);
  }
  return s;
}

/**
 * Forecast accuracy: second half of the 30-day window — sum of one-step-ahead SES forecasts
 * vs actual daily demand (proxy for "last month" fit).
 */
export function forecastAccuracyPercent(x: number[], alpha: number): number {
  if (x.length < 16) return 0;
  const s = exponentialSmoothing(x, alpha);
  const start = 15; // days 16–30 (1-based: "latter half")
  let predSum = 0;
  let actSum = 0;
  for (let t = start; t < 30; t++) {
    actSum += x[t]!;
    predSum += s[t - 1]!;
  }
  if (actSum < 1e-6) return 0;
  const mape = Math.abs(predSum - actSum) / actSum;
  return Math.max(0, Math.min(100, Math.round(100 * (1 - mape))));
}

export interface ForecastDayRow {
  label: string;
  day: number;
  predicted: number;
  upper: number;
  lower: number;
}

export interface DemandForecastResult {
  chartRows: ForecastDayRow[];
  accuracyPct: number;
  hasSignal: boolean;
}

/**
 * 30 future days: level = last SES smoothed value; intervals widen with sqrt(horizon).
 */
export function build30DayDemandForecast(
  salesLast30: number,
  productId: string,
  alpha = SES_ALPHA
): DemandForecastResult {
  const x = dailyDemandBuckets(salesLast30, productId);
  const hasSignal = salesLast30 > 0;
  if (!hasSignal) {
    return {
      chartRows: Array.from({ length: 30 }, (_, i) => ({
        label: `Day ${i + 1}`,
        day: i + 1,
        predicted: 0,
        upper: 0.5,
        lower: 0,
      })),
      accuracyPct: 0,
      hasSignal: false,
    };
  }

  const s = exponentialSmoothing(x, alpha);
  const lastLevel = s[29]!;
  const oneStepPred: number[] = [x[0]!];
  for (let t = 1; t < 30; t++) oneStepPred.push(s[t - 1]!);
  const residuals = x.map((xt, t) => xt - oneStepPred[t]!);
  const sigmaSq = residuals.reduce((a, e) => a + e * e, 0) / Math.max(residuals.length, 1);
  let sigma = Math.sqrt(Math.max(sigmaSq, 0));
  if (sigma < 0.01) sigma = Math.max(lastLevel * 0.12, 0.08);

  const accuracyPct = forecastAccuracyPercent(x, alpha);
  const z = 1.645;

  const chartRows: ForecastDayRow[] = [];
  for (let h = 1; h <= 30; h++) {
    const pred = Math.max(0, lastLevel);
    const widen = Math.sqrt(0.25 + h);
    const margin = z * sigma * widen;
    chartRows.push({
      label: `Day ${h}`,
      day: h,
      predicted: pred,
      upper: Math.max(0, pred + margin),
      lower: Math.max(0, pred - margin),
    });
  }

  return { chartRows, accuracyPct, hasSignal: true };
}
