import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import type { CopilotChatMessage } from '@/hooks/useCopilot';
import brandMark from '@/assets/inveron-brand.png';

const mdComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => <em className="italic">{children}</em>,
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li className="leading-relaxed">{children}</li>,
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-1 mt-2 text-sm font-display font-semibold text-foreground first:mt-0">{children}</h3>
  ),
};

function CopilotMessageInner({ message }: { message: CopilotChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex w-full gap-2', isUser ? 'justify-end' : 'justify-start items-start')}>
      {!isUser && (
        <img
          src={brandMark}
          alt=""
          className="mt-0.5 h-8 w-8 shrink-0 rounded-lg object-cover ring-1 ring-border/70"
          width={32}
          height={32}
        />
      )}
      <div
        className={cn(
          'max-w-[min(100%,26rem)] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ring-1',
          isUser
            ? 'bg-primary text-primary-foreground ring-primary/20'
            : message.isError
              ? 'bg-destructive/10 text-destructive ring-destructive/25'
              : 'bg-muted/90 text-foreground ring-border/60'
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <div className="max-w-none text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(CopilotMessageInner);
