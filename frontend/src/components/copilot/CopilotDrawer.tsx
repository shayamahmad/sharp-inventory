import React, { type RefObject } from 'react';
import { Send } from 'lucide-react';
import brandMark from '@/assets/inveron-brand.png';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import CopilotMessage from './CopilotMessage';
import type { CopilotChatMessage } from '@/hooks/useCopilot';

export interface CopilotDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: CopilotChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  isThinking: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
}

export default function CopilotDrawer({
  open,
  onOpenChange,
  messages,
  input,
  onInputChange,
  onSend,
  isThinking,
  messagesEndRef,
}: CopilotDrawerProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isThinking) void onSend();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex h-[100dvh] max-h-[100dvh] w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="shrink-0 space-y-0 border-b border-border px-4 pb-3 pt-4 sm:px-6">
          <div className="flex items-center gap-3 pr-10">
            <img
              src={brandMark}
              alt=""
              className="h-11 w-11 shrink-0 rounded-xl object-cover ring-1 ring-border shadow-sm"
              width={44}
              height={44}
            />
            <div className="min-w-0">
              <SheetTitle className="text-left">Inveron Copilot</SheetTitle>
              <p className="text-xs text-muted-foreground">Inventory Q&amp;A powered by your live data</p>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1 px-4 sm:px-6">
          <div className="flex flex-col gap-3 py-4 pr-2">
            {messages.map((m) => (
              <CopilotMessage key={m.id} message={m} />
            ))}
            {isThinking && (
              <div className="flex justify-start" aria-live="polite">
                <div className="rounded-2xl bg-muted/80 px-4 py-2.5 text-sm italic text-muted-foreground ring-1 ring-border/60">
                  Copilot is thinking…
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-px shrink-0" aria-hidden />
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t border-border bg-background/95 p-3 backdrop-blur-sm sm:p-4">
          <div className="flex items-end gap-2">
            <Input
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about stock, orders, POs…"
              className="min-h-10 flex-1"
              disabled={isThinking}
              aria-label="Copilot message"
            />
            <Button
              type="button"
              size="icon"
              className="h-10 w-10 shrink-0"
              disabled={!input.trim() || isThinking}
              onClick={() => void onSend()}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
