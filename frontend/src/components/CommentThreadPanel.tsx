import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';

export interface ThreadComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  ts: string;
  mentions: string[];
}

interface CommentThreadPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  comments: ThreadComment[];
  onSend: (text: string, mentions: string[]) => void;
  users: { id: string; name: string }[];
  currentUser: { id: string; name: string };
  onAfterOpen?: () => void;
}

function extractMentions(text: string, userNames: string[]): string[] {
  const found: string[] = [];
  for (const name of userNames) {
    if (text.includes(`@${name}`)) found.push(name);
  }
  return found;
}

function renderTextWithChips(text: string, mentionNames: string[]): React.ReactNode {
  if (mentionNames.length === 0) return text;
  const pattern = new RegExp(
    `(@(?:${mentionNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}))`,
    'g'
  );
  const parts = text.split(pattern);
  return parts.map((part, i) => {
    if (part.startsWith('@') && mentionNames.some((m) => `@${m}` === part)) {
      return (
        <span key={i} className="inline-flex items-center rounded bg-primary/20 text-primary px-1 py-0.5 text-xs font-medium mx-0.5">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function countUnreadThreadComments(comments: ThreadComment[], lastViewedIso: string | undefined): number {
  if (comments.length === 0) return 0;
  if (!lastViewedIso) return comments.length;
  const t = new Date(lastViewedIso).getTime();
  if (Number.isNaN(t)) return comments.length;
  return comments.filter((c) => new Date(c.ts).getTime() > t).length;
}

export default function CommentThreadPanel({
  open,
  onClose,
  title,
  comments,
  onSend,
  users,
  currentUser,
  onAfterOpen,
}: CommentThreadPanelProps) {
  const [draft, setDraft] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const userNames = useMemo(() => users.map((u) => u.name), [users]);

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      onAfterOpen?.();
    }
    wasOpen.current = open;
    if (!open) return;
    setDraft('');
    setMentionOpen(false);
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, [open, onAfterOpen]);

  useEffect(() => {
    if (!open) return;
    const at = draft.lastIndexOf('@');
    if (at >= 0) {
      const after = draft.slice(at + 1);
      if (!after.includes(' ') && after.length < 40) {
        setMentionFilter(after.toLowerCase());
        setMentionOpen(true);
        return;
      }
    }
    setMentionOpen(false);
  }, [draft, open]);

  const filteredUsers = useMemo(() => {
    if (!mentionFilter) return users.slice(0, 8);
    return users.filter((u) => u.name.toLowerCase().includes(mentionFilter)).slice(0, 8);
  }, [users, mentionFilter]);

  const insertMention = (name: string) => {
    const at = draft.lastIndexOf('@');
    if (at < 0) return;
    const next = `${draft.slice(0, at)}@${name} `;
    setDraft(next);
    setMentionOpen(false);
  };

  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    onSend(t, extractMentions(t, userNames));
    setDraft('');
  };

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] bg-background/40 backdrop-blur-[2px]"
        aria-label="Close comments"
        onClick={onClose}
      />
      <div className="fixed bottom-0 left-0 right-0 z-[70] border-t border-border bg-card shadow-[0_-8px_30px_rgba(0,0,0,0.12)] max-h-[min(52vh,520px)] flex flex-col md:left-[var(--sidebar-offset,0px)]">
        <style>{`:root{--sidebar-offset:0px}`}</style>
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/40">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[120px]">
          {comments.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No comments yet.</p>}
          {comments.map((c) => {
            const mine = c.userId === currentUser.id || c.userName === currentUser.name;
            return (
              <div key={c.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    mine ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted text-foreground rounded-bl-md'
                  }`}
                >
                  {!mine && <p className="text-[10px] font-semibold opacity-80 mb-0.5">{c.userName}</p>}
                  <p className="whitespace-pre-wrap break-words leading-snug">{renderTextWithChips(c.text, c.mentions)}</p>
                  <p className={`text-[10px] mt-1 tabular-nums ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {c.ts}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="p-3 border-t border-border bg-card relative">
          {mentionOpen && filteredUsers.length > 0 && (
            <div className="absolute bottom-full left-3 right-3 mb-1 rounded-lg border border-border bg-popover shadow-md max-h-36 overflow-y-auto z-10">
              {filteredUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-secondary"
                  onClick={() => insertMention(u.name)}
                >
                  @{u.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type a message… use @ to mention"
              className="flex-1 h-10 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <Button type="button" className="h-10 shrink-0" onClick={submit}>
              Send
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
