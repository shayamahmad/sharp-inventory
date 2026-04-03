import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Mic, MicOff, Send, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import { processConversationTurn, type ConversationMessage } from '@/lib/conversationEngine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((ev: Event) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRec) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function speakText(text: string, muted: boolean): Promise<void> {
  if (muted || typeof window === 'undefined' || !window.speechSynthesis) {
    return Promise.resolve();
  }
  window.speechSynthesis.cancel();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(
      text
        .replace(/₹/g, 'rupees ')
        .replace(/\*\*/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 520)
    );
    u.lang = 'en-IN';
    u.rate = 0.98;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

function BubbleText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) {
          return (
            <strong key={i} className="font-semibold text-foreground">
              {p.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </span>
  );
}

const WELCOME = [
  "I'm your **Inveron** assistant. I see your live products, orders, customers, and purchase orders.",
  '',
  'Ask in plain language or type below. Tap **Speak** for the mic. Enable **Hands-free** and I’ll turn the mic back on after I answer so you can keep talking.',
].join('\n');

export default function VoiceAssistantPanel({
  open,
  onClose,
  onNavigate,
  autoStartListening = false,
  onAutoStartListeningConsumed,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (
    page: string,
    opts?: {
      openPurchaseOrderModal?: boolean;
      productsLowStock?: boolean;
      scrollDashboardAnomalies?: boolean;
    }
  ) => void;
  /** When true (e.g. user opened from header mic), start mic once after panel opens */
  autoStartListening?: boolean;
  onAutoStartListeningConsumed?: () => void;
}) {
  const { products, orders, purchaseOrders, customers } = useInventory();
  const [messages, setMessages] = useState<ConversationMessage[]>(() => [
    { role: 'assistant', content: WELCOME, ts: Date.now() },
  ]);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [handsFree, setHandsFree] = useState(true);
  const [muteSpeech, setMuteSpeech] = useState(false);
  const [busy, setBusy] = useState(false);

  const messagesRef = useRef(messages);
  const openRef = useRef(open);
  const handsFreeRef = useRef(handsFree);
  const muteSpeechRef = useRef(muteSpeech);
  const busyRef = useRef(false);
  const recRef = useRef<SpeechRec | null>(null);
  const relistenTimerRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const runUserTextRef = useRef<(text: string) => Promise<void>>(async () => {});

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    handsFreeRef.current = handsFree;
  }, [handsFree]);
  useEffect(() => {
    muteSpeechRef.current = muteSpeech;
  }, [muteSpeech]);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open, interim, busy]);

  const clearRelisten = useCallback(() => {
    if (relistenTimerRef.current != null) {
      window.clearTimeout(relistenTimerRef.current);
      relistenTimerRef.current = null;
    }
  }, []);

  const stopListening = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    setListening(false);
    setInterim('');
  }, []);

  const attachRecognitionHandlers = useCallback((rec: SpeechRec) => {
    rec.onresult = (ev: Event) => {
      const e = ev as unknown as {
        resultIndex: number;
        results: { length: number; [k: number]: { 0: { transcript: string }; isFinal: boolean } };
      };
      let finalText = '';
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += r;
        else interimText += r;
      }
      if (interimText) setInterim(interimText.trim());
      if (finalText.trim()) {
        setInterim('');
        void runUserTextRef.current(finalText.trim());
      }
    };
    rec.onerror = () => stopListening();
    rec.onend = () => {
      setListening(false);
      setInterim('');
    };
  }, [stopListening]);

  const beginListening = useCallback(() => {
    if (busyRef.current || !openRef.current) return;
    clearRelisten();
    window.speechSynthesis.cancel();
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    try {
      stopListening();
      const rec = new Ctor();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = 'en-IN';
      attachRecognitionHandlers(rec);
      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [attachRecognitionHandlers, stopListening, clearRelisten]);

  const runUserText = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busyRef.current) return;

      clearRelisten();
      stopListening();
      window.speechSynthesis.cancel();

      busyRef.current = true;
      setBusy(true);

      const userMsg: ConversationMessage = { role: 'user', content: text, ts: Date.now() };
      const history = [...messagesRef.current, userMsg];
      messagesRef.current = history;
      setMessages(history);

      const ctx = { products, orders, purchaseOrders, customers };
      const reply = processConversationTurn(text, history.slice(0, -1), ctx);

      const asstMsg: ConversationMessage = {
        role: 'assistant',
        content: reply.text,
        ts: Date.now(),
      };
      const nextHist = [...history, asstMsg];
      messagesRef.current = nextHist;
      setMessages(nextHist);

      if (reply.navigate) {
        onNavigate(reply.navigate.page, {
          openPurchaseOrderModal: reply.navigate.openPurchaseOrderModal,
          productsLowStock: reply.navigate.productsLowStock,
          scrollDashboardAnomalies: reply.navigate.scrollDashboardAnomalies,
        });
      }

      await speakText(reply.textForSpeech, muteSpeechRef.current);

      busyRef.current = false;
      setBusy(false);

      if (
        openRef.current &&
        handsFreeRef.current &&
        !muteSpeechRef.current &&
        getRecognitionCtor()
      ) {
        relistenTimerRef.current = window.setTimeout(() => {
          if (!openRef.current || busyRef.current) return;
          beginListening();
        }, 650);
      }
    },
    [products, orders, purchaseOrders, customers, onNavigate, clearRelisten, stopListening, beginListening]
  );

  useEffect(() => {
    runUserTextRef.current = runUserText;
  }, [runUserText]);

  useEffect(() => {
    if (!open || !autoStartListening || !getRecognitionCtor()) return;
    const id = window.requestAnimationFrame(() => {
      beginListening();
      onAutoStartListeningConsumed?.();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, autoStartListening, beginListening, onAutoStartListeningConsumed]);

  useEffect(() => {
    if (!open) {
      clearRelisten();
      stopListening();
      window.speechSynthesis.cancel();
    }
  }, [open, clearRelisten, stopListening]);

  useEffect(
    () => () => {
      clearRelisten();
      stopListening();
      window.speechSynthesis.cancel();
    },
    [clearRelisten, stopListening]
  );

  const onSubmitText = (e: React.FormEvent) => {
    e.preventDefault();
    const t = input.trim();
    if (!t) return;
    setInput('');
    void runUserText(t);
  };

  const supported = typeof window !== 'undefined' && !!getRecognitionCtor();

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[190] bg-background/60 backdrop-blur-[2px] md:hidden"
        aria-label="Close assistant"
        onClick={onClose}
      />
      <aside
        className="fixed right-0 top-0 z-[200] flex h-[100dvh] max-h-[100dvh] w-full max-w-md flex-col border-l border-border bg-card pt-[env(safe-area-inset-top,0px)] shadow-2xl animate-fade-in"
        aria-label="Inveron voice assistant"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0">
              <h2 className="font-display font-bold text-foreground text-sm truncate">Inveron assistant</h2>
              <p className="text-[10px] text-muted-foreground truncate">Live inventory · Voice &amp; chat</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 px-3 py-2 border-b border-border bg-muted/30 shrink-0">
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={handsFree}
              onChange={(e) => setHandsFree(e.target.checked)}
              className="rounded border-input"
            />
            Hands-free
          </label>
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={muteSpeech}
              onChange={(e) => setMuteSpeech(e.target.checked)}
              className="rounded border-input"
            />
            Mute voice
          </label>
          {muteSpeech ? <VolumeX className="h-3.5 w-3.5 text-muted-foreground" /> : <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {messages.map((m, i) => (
            <div
              key={`${m.ts}-${i}`}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[92%] rounded-2xl px-3 py-2.5 text-sm ${
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-secondary/80 text-foreground border border-border/50 rounded-bl-md'
                }`}
              >
                <BubbleText text={m.content} />
              </div>
            </div>
          ))}
          {interim && (
            <div className="flex justify-end">
              <div className="max-w-[92%] rounded-2xl rounded-br-md px-3 py-2 text-sm bg-primary/25 text-foreground border border-dashed border-primary/40 italic">
                {interim}…
              </div>
            </div>
          )}
          {busy && (
            <div className="text-[11px] text-muted-foreground flex items-center gap-2 px-1">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Thinking with your data…
            </div>
          )}
        </div>

        <div className="shrink-0 space-y-2 border-t border-border bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
          <form onSubmit={onSubmitText} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about stock, orders, revenue…"
              className="h-10 flex-1"
              disabled={busy}
            />
            <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={busy || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <div className="flex gap-2">
            {supported ? (
              <Button
                type="button"
                variant={listening ? 'destructive' : 'secondary'}
                className="flex-1 gap-2"
                onClick={() => (listening ? stopListening() : beginListening())}
                disabled={busy}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {listening ? 'Stop mic' : 'Speak'}
              </Button>
            ) : (
              <p className="text-[10px] text-muted-foreground py-2">Voice needs Chrome / Edge (Web Speech API).</p>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
