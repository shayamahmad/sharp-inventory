import type { CopilotAppContext } from './getAppContext';
import { serializeCopilotContext } from './getAppContext';

const SYSTEM_PROMPT =
  'You are an intelligent inventory management assistant. Analyze the provided business data and answer user queries with clear, concise, and actionable insights. Always use numbers, ₹ values, trends, and specific product or supplier names when relevant. Support why, what-if, summary, recommendation, and analytical queries. Format responses using bullet points, bold highlights, and short paragraphs.';

function buildUserBlock(userInput: string, contextJson: string): string {
  return `DATA:\n${contextJson}\n\nQUESTION:\n${userInput}`;
}

async function callAnthropic(apiKey: string, userBlock: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userBlock }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Anthropic ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = data.content?.find((c) => c.type === 'text')?.text;
  if (!text || !text.trim()) throw new Error('Empty Anthropic response');
  return text.trim();
}

async function callOpenAI(apiKey: string, userBlock: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 2048,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userBlock },
      ],
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text || !text.trim()) throw new Error('Empty OpenAI response');
  return text.trim();
}

function ruleBasedFallback(userInput: string, ctx: CopilotAppContext): string {
  const q = userInput.toLowerCase();
  const lines: string[] = [];

  lines.push(`### Snapshot`);
  lines.push(`- **Health score:** **${ctx.healthScore.total}/100** (${ctx.healthScore.tier})`);
  lines.push(`- **Products:** ${ctx.meta.productCount} · **Orders:** ${ctx.meta.orderCount} · **POs:** ${ctx.meta.poCount}`);
  lines.push(`- **Live-style alerts:** ${ctx.meta.alertsCount}`);

  const lowStock = ctx.products.filter((p) => p.stockStatus === 'critical' || p.stockStatus === 'out' || p.stock <= p.minStock);
  if (q.includes('health') || q.includes('score')) {
    lines.push(`\n### Health breakdown`);
    for (const c of ctx.healthScore.components) {
      lines.push(`- **${c.label}:** ${c.points.toFixed(1)}/${c.maxPoints} pts — ${c.detail}`);
    }
  }

  if (q.includes('low') || q.includes('stock') || q.includes('reorder') || q.length < 4) {
    lines.push(`\n### Low / at-risk stock (sample)`);
    const sample = lowStock.slice(0, 8);
    if (sample.length === 0) lines.push(`- No critical low-stock rows in the snapshot.`);
    else {
      for (const p of sample) {
        lines.push(`- **${p.name}** — ${p.stock} on hand vs min **${p.minStock}** · 30d sales **${p.salesLast30}** · **${formatInr(p.price)}**`);
      }
    }
  }

  if (q.includes('order') || q.includes('summary')) {
    const byStatus = new Map<string, number>();
    for (const o of ctx.orders) {
      byStatus.set(o.status, (byStatus.get(o.status) ?? 0) + 1);
    }
    lines.push(`\n### Order summary`);
    lines.push(`- **Total orders in data:** ${ctx.orders.length}`);
    for (const [st, n] of [...byStatus.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push(`- **${st}:** ${n}`);
    }
    const recent = [...ctx.orders].slice(-5).reverse();
    if (recent.length) {
      lines.push(`- **Recent (last 5 in list):**`);
      for (const o of recent) {
        lines.push(`  - ${o.id} · ${o.customerName} · **${o.totalFormatted}** · ${o.status}`);
      }
    }
  }

  if (q.includes('supplier') || q.includes('po') || q.includes('purchase')) {
    const lateSuppliers = new Map<string, number>();
    for (const po of ctx.purchaseOrders) {
      if (po.discrepancy) lateSuppliers.set(po.supplier, (lateSuppliers.get(po.supplier) ?? 0) + 1);
    }
    lines.push(`\n### Purchase orders`);
    lines.push(`- **Total POs:** ${ctx.purchaseOrders.length}`);
    if (lateSuppliers.size) {
      lines.push(`- **Suppliers with discrepancies:**`);
      for (const [s, n] of [...lateSuppliers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
        lines.push(`  - **${s}:** ${n} flagged PO(s)`);
      }
    }
  }

  if (ctx.anomalies.length && (q.includes('anomal') || q.includes('risk') || q.length < 4)) {
    lines.push(`\n### Anomalies`);
    for (const a of ctx.anomalies.slice(0, 6)) {
      lines.push(`- **${a.label}** (${a.severity}): ${a.description}`);
    }
  }

  lines.push(`\n_Add a **VITE_ANTHROPIC_API_KEY** or **VITE_OPENAI_API_KEY** in \`.env\` for full AI answers. This reply used on-device rules._`);

  return lines.join('\n');
}

function formatInr(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

/**
 * Calls Claude or OpenAI when keys are present; otherwise returns rule-based markdown.
 * Never throws to callers — failures yield fallback text.
 */
export async function generateCopilotResponse(userInput: string, context: CopilotAppContext): Promise<string> {
  const trimmed = userInput.trim();
  if (!trimmed) return '_Ask a question about inventory, stock, orders, or suppliers._';

  const contextJson = serializeCopilotContext(context);
  const userBlock = buildUserBlock(trimmed, contextJson);

  const anthropicKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;

  try {
    if (typeof anthropicKey === 'string' && anthropicKey.length > 0) {
      return await callAnthropic(anthropicKey, userBlock);
    }
    if (typeof openaiKey === 'string' && openaiKey.length > 0) {
      return await callOpenAI(openaiKey, userBlock);
    }
  } catch {
    /* API error → rule-based fallback */
  }

  return ruleBasedFallback(trimmed, context);
}
