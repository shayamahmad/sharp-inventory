import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { getAppContext } from '@/lib/copilot/getAppContext';
import { generateCopilotResponse } from '@/lib/copilot/generateCopilotResponse';

const SESSION_KEY = 'inveron-copilot-messages-v1';
const SEND_DEBOUNCE_MS = 380;

export type CopilotRole = 'user' | 'assistant';

export interface CopilotChatMessage {
  id: string;
  role: CopilotRole;
  content: string;
  createdAt: string;
  isError?: boolean;
}

function newId(): string {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const WELCOME: CopilotChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Hi — I\'m **Inveron Copilot**. Ask about **stock**, **orders**, **purchase orders**, **health score**, or **risks**. I analyze the data currently loaded in your app.',
  createdAt: new Date(0).toISOString(),
};

function isChatMessage(x: unknown): x is CopilotChatMessage {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    (o.role === 'user' || o.role === 'assistant') &&
    typeof o.content === 'string' &&
    typeof o.createdAt === 'string'
  );
}

function loadSession(): CopilotChatMessage[] {
  if (typeof sessionStorage === 'undefined') return [WELCOME];
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return [WELCOME];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [WELCOME];
    const list = parsed.filter(isChatMessage);
    return list.length > 0 ? list : [WELCOME];
  } catch {
    return [WELCOME];
  }
}

function saveSession(messages: CopilotChatMessage[]): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages));
  } catch {
    /* quota / private mode */
  }
}

export interface UseCopilotResult {
  open: boolean;
  setOpen: (v: boolean) => void;
  messages: CopilotChatMessage[];
  input: string;
  setInput: (v: string) => void;
  send: () => Promise<void>;
  isThinking: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
}

export function useCopilot(): UseCopilotResult {
  const { products, orders, purchaseOrders } = useInventory();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<CopilotChatMessage[]>(loadSession);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const lastSendAt = useRef(0);
  const inFlight = useRef(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    saveSession(messages);
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isThinking, open]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || inFlight.current) return;

    const now = Date.now();
    if (now - lastSendAt.current < SEND_DEBOUNCE_MS) return;
    lastSendAt.current = now;

    inFlight.current = true;
    setIsThinking(true);
    setInput('');

    const userMsg: CopilotChatMessage = {
      id: newId(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const ctx = getAppContext(products, orders, purchaseOrders);
      const reply = await generateCopilotResponse(text, ctx);
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          content: reply,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          content:
            '**Something went wrong** while generating a reply. Please try again in a moment. Offline rule-based answers still work when API keys are not configured.',
          createdAt: new Date().toISOString(),
          isError: true,
        },
      ]);
    } finally {
      inFlight.current = false;
      setIsThinking(false);
    }
  }, [input, products, orders, purchaseOrders]);

  return {
    open,
    setOpen,
    messages,
    input,
    setInput,
    send,
    isThinking,
    messagesEndRef: bottomRef,
  };
}
