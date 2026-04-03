/**
 * Deterministic id from type + targetId + calendar day (YYYY-MM-DD).
 */
export function makeAgentActionId(type: string, targetId: string, now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const dayYmd = `${y}-${m}-${d}`;
  return hashAgentKey(`${type}|${targetId}|${dayYmd}`);
}

export function actionSignature(type: string, targetId: string): string {
  return `${type}::${targetId}`;
}

/** djb2-ish deterministic hash → compact base36 id */
export function hashAgentKey(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  const u = h >>> 0;
  return `a-${u.toString(36)}`;
}
