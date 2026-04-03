import React from 'react';
import { useCopilot } from '@/hooks/useCopilot';
import CopilotButton from './CopilotButton';
import CopilotDrawer from './CopilotDrawer';

/**
 * Floating copilot entry: mounts the button + sheet. Place once inside the authenticated shell.
 */
export default function InventoryCopilotLauncher() {
  const { open, setOpen, messages, input, setInput, send, isThinking, messagesEndRef } = useCopilot();

  return (
    <>
      <CopilotButton onClick={() => setOpen(true)} />
      <CopilotDrawer
        open={open}
        onOpenChange={setOpen}
        messages={messages}
        input={input}
        onInputChange={setInput}
        onSend={send}
        isThinking={isThinking}
        messagesEndRef={messagesEndRef}
      />
    </>
  );
}
