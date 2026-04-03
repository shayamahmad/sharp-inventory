import { processNLQuery } from '@/lib/nlQueryEngine';
import {
  processVoiceTranscript,
  queryResultToVoiceSummary,
  type VoiceNavIntent,
} from '@/lib/voiceCommands';
import type { Product, Order } from '@/lib/mockData';
import type { PurchaseOrder, Customer } from '@/contexts/InventoryContext';

export type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
};

export type InventoryVoiceContext = {
  products: Product[];
  orders: Order[];
  purchaseOrders: PurchaseOrder[];
  customers: Customer[];
};

const PAGE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  products: 'Products',
  orders: 'Orders',
  customers: 'Customers',
  analytics: 'Analytics',
  alerts: 'Alerts',
  purchaseOrders: 'Purchase orders',
  manufacturing: 'Manufacturing',
  replenishment: 'Replenishment',
  predictions: 'Predictions',
  cashFlow: 'Cash flow',
  quotations: 'Quotations',
  activity: 'Activity log',
  users: 'Users',
  simulation: 'Simulation',
};

function humanPageName(page: string): string {
  return PAGE_LABELS[page] ?? page.replace(/([A-Z])/g, ' $1').trim();
}

/** Map assistant bold page title → phrase understood by voice router */
const OPEN_PHRASE_FROM_LABEL: Record<string, string> = {
  Dashboard: 'open dashboard',
  Products: 'open products',
  Orders: 'open orders',
  Customers: 'open customers',
  Analytics: 'open analytics',
  Alerts: 'open alerts',
  'Purchase orders': 'open purchase orders',
  Manufacturing: 'open manufacturing',
  Replenishment: 'open replenishment',
  Predictions: 'open predictions',
  'Cash flow': 'open cash flow',
  Quotations: 'open quotations',
  'Activity log': 'open activity',
  Users: 'open users',
  Simulation: 'open simulation',
};

/** Merge short follow-ups with prior turn (e.g. "and electronics" after "show low stock"). */
export function expandUtteranceForConversation(
  userText: string,
  history: ConversationMessage[]
): string {
  const t = userText.trim();
  const lower = t.toLowerCase();
  const lastUser = [...history].reverse().find((m) => m.role === 'user');

  if (/^(and|also|what about|how about)\s+/i.test(t) && lastUser) {
    return `${lastUser.content} ${t.replace(/^(and|also|what about|how about)\s+/i, '')}`.trim();
  }

  if (/^(open it|go there|take me there|show me that)$/i.test(lower)) {
    const lastAsst = [...history].reverse().find((m) => m.role === 'assistant');
    if (lastAsst) {
      const bold = lastAsst.content.match(/\*\*([^*]+)\*\*/);
      if (bold) {
        const phrase = OPEN_PHRASE_FROM_LABEL[bold[1].trim()];
        if (phrase) return phrase;
      }
    }
  }

  return t;
}

function toSpeakable(text: string, maxLen = 480): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/₹/g, 'rupees ')
    .replace(/[•·]/g, '')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function clarifyNone(heard: string): string {
  return [
    `I heard: “${heard}”.`,
    '',
    'In **Inveron** I can help with:',
    '• Stock, prices, low stock, top sellers, profit, revenue',
    '• Orders (pending, delivered, recent)',
    '• Customers, purchase orders, health score',
    '• **Navigation** — say *open products*, *go to analytics*, *show low stock*',
    '',
    'Try one sentence at a time. I use your **live** inventory data.',
  ].join('\n');
}

export type ConversationTurnResult = {
  /** Markdown-lite for chat bubbles */
  text: string;
  /** Shorter line for speech synthesis */
  textForSpeech: string;
  navigate?: VoiceNavIntent;
};

export function processConversationTurn(
  userText: string,
  history: ConversationMessage[],
  ctx: InventoryVoiceContext
): ConversationTurnResult {
  const expanded = expandUtteranceForConversation(userText.trim(), history);
  const voiceCtx = {
    products: ctx.products,
    orders: ctx.orders,
    purchaseOrders: ctx.purchaseOrders,
    customers: ctx.customers,
  };

  const res = processVoiceTranscript(expanded, voiceCtx);

  if (res.type === 'nav') {
    const label = humanPageName(res.intent.page);
    const text = [
      `Opening **${label}** now.`,
      '',
      `Keep talking — ask another question, or say *open* / *go to* another area.`,
    ].join('\n');
    return {
      text,
      textForSpeech: `Opening ${label}. What else can I help with?`,
      navigate: res.intent,
    };
  }

  if (res.type === 'toast') {
    return {
      text: res.message,
      textForSpeech: toSpeakable(res.message.split('\n')[0] + (res.message.includes('•') ? '. More detail is in the chat.' : '')),
    };
  }

  const nl = processNLQuery(expanded, ctx.products, ctx.orders);
  if (nl && nl.items.length > 0) {
    const body = queryResultToVoiceSummary(nl);
    return {
      text: body,
      textForSpeech: toSpeakable(`${nl.title}. Showing ${Math.min(3, nl.items.length)} highlights.`),
    };
  }
  if (nl && nl.items.length === 0) {
    return {
      text: `${nl.title}\n\nNo rows matched in your current data. Try rephrasing or check spelling.`,
      textForSpeech: `${nl.title}. No matching data.`,
    };
  }

  return {
    text: clarifyNone(res.heard),
    textForSpeech: toSpeakable(
      `I'm not sure about that. Ask about stock, orders, revenue, or say go to dashboard.`
    ),
  };
}
