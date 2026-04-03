/**
 * Best-effort parse of ₹ amounts from agent impact strings (deterministic, no locale).
 */
export function parseImpactInr(impact: string): number | null {
  const m = impact.match(/₹\s*([\d,]+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}
