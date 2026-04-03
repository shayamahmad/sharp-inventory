import React from 'react';
import { cn } from '@/lib/utils';
import brandMark from '@/assets/inveron-brand.png';

interface CopilotButtonProps {
  onClick: () => void;
  className?: string;
}

export default function CopilotButton({ onClick, className }: CopilotButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open Inveron Copilot"
      className={cn(
        'fixed bottom-5 right-5 z-[190] flex h-14 w-14 items-center justify-center overflow-hidden rounded-full p-0.5',
        'bg-background shadow-lg ring-2 ring-primary/35 transition-transform hover:scale-105 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className
      )}
    >
      <img src={brandMark} alt="" className="h-full w-full rounded-[0.85rem] object-cover" width={56} height={56} />
    </button>
  );
}
