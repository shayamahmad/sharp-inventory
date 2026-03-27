/** Next sequential id (e.g. P019, ORD022) from existing ids with the same letter prefix. */
export function nextPrefixedId(prefix: string, existingIds: readonly string[]): string {
  let max = 0;
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}(\\d+)$`, 'i');
  for (const id of existingIds) {
    const m = id.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const n = max + 1;
  const digits = Math.max(3, String(n).length);
  return `${prefix}${String(n).padStart(digits, '0')}`;
}
