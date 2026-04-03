import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { toast } from 'sonner';
import { useInventory } from '@/contexts/InventoryContext';
import { processVoiceTranscript } from '@/lib/voiceCommands';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

export default function VoiceCommandsBar({
  onNavigate,
}: {
  onNavigate: (
    page: string,
    opts?: { openPurchaseOrderModal?: boolean; productsLowStock?: boolean; scrollDashboardAnomalies?: boolean }
  ) => void;
}) {
  const { products, orders, purchaseOrders } = useInventory();
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const supported = typeof window !== 'undefined' && !!getRecognitionCtor();

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      toast.error('Voice not supported — use Google Chrome on desktop.');
      return;
    }
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-IN';
    rec.onresult = (ev: Event) => {
      const e = ev as unknown as { results: { 0: { 0: { transcript: string } } } };
      const text = e.results[0][0].transcript?.trim() ?? '';
      if (!text) return;
      const res = processVoiceTranscript(text, { products, orders, purchaseOrders });
      if (res.type === 'toast') toast.message(res.message);
      else if (res.type === 'nav') {
        onNavigate(res.intent.page, {
          openPurchaseOrderModal: res.intent.openPurchaseOrderModal,
          productsLowStock: res.intent.productsLowStock,
          scrollDashboardAnomalies: res.intent.scrollDashboardAnomalies,
        });
        toast.message(`Opening ${res.intent.page.replace(/([A-Z])/g, ' $1').trim()}…`);
      } else toast.message(`Heard: “${text}” — no matching command.`);
      stop();
    };
    rec.onerror = () => {
      toast.error('Voice recognition error');
      stop();
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      toast.error('Could not start microphone');
      setListening(false);
    }
  }, [products, orders, purchaseOrders, onNavigate, stop]);

  useEffect(() => () => stop(), [stop]);

  const helpText = [
    '“How many units of [product or category]”',
    '“Go to [dashboard, products, orders, analytics, …]”',
    '“Show low stock”',
    '“Show critical alerts”',
    '“Create purchase order”',
    '“What is my health score”',
    '“Show top sellers”',
    '“Show anomalies”',
  ].join('\n');

  if (!supported) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs text-muted-foreground px-2 py-1 rounded-md bg-secondary cursor-default">
              Voice N/A
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            Voice commands need Chrome (Web Speech API).
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => (listening ? stop() : start())}
            className={`relative p-2.5 rounded-lg transition-colors ${
              listening ? 'bg-destructive/20 text-destructive' : 'bg-secondary hover:bg-secondary/80 text-foreground'
            }`}
            aria-label={listening ? 'Stop listening' : 'Start voice command'}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {listening && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-sm text-xs whitespace-pre-line">
          <p className="font-semibold mb-1">Voice commands (Chrome)</p>
          {helpText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
