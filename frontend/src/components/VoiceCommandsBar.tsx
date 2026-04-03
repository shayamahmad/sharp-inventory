import React from 'react';
import { Mic, MessageCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

function getRecognitionCtor(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return !!(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

export default function VoiceCommandsBar({
  onOpenAssistant,
}: {
  /** Navigation is handled inside the assistant panel; kept for API compatibility. */
  onNavigate?: (
    page: string,
    opts?: { openPurchaseOrderModal?: boolean; productsLowStock?: boolean; scrollDashboardAnomalies?: boolean }
  ) => void;
  /** Opens the conversational assistant (voice + chat). When omitted, mic is hidden. */
  onOpenAssistant?: () => void;
}) {
  const supported = getRecognitionCtor();

  const helpText = [
    'Opens the **Inveron assistant** — live data, back-and-forth chat, and voice (Hands-free keeps the mic on).',
    'Same smarts as before: stock, orders, revenue, navigation, and more.',
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
            Assistant voice needs Chrome or Edge (Web Speech API).
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (!onOpenAssistant) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onOpenAssistant()}
            className="relative p-2.5 rounded-lg transition-colors bg-secondary hover:bg-secondary/80 text-foreground"
            aria-label="Open Inveron assistant"
          >
            <span className="relative inline-flex">
              <Mic className="h-4 w-4" />
              <MessageCircle className="h-2.5 w-2.5 absolute -bottom-0.5 -right-0.5 text-primary" aria-hidden />
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-sm text-xs whitespace-pre-line">
          <p className="font-semibold mb-1">Inveron assistant</p>
          {helpText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
