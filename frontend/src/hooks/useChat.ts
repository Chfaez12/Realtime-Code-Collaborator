import { useCallback, useEffect, useState } from "react";
import type * as Y from "yjs";
import type { ChatMessage } from "../types/message";

const MAX_MESSAGES = 200; 

export function useChat(doc: Y.Doc | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!doc) return;
    const chat = doc.getArray<ChatMessage>("chat");

    const update = () => setMessages(chat.toArray());
    chat.observe(update);
    update();

    return () => chat.unobserve(update);
  }, [doc]);

  const send = useCallback(
    (msg: Omit<ChatMessage, "id" | "timestamp">) => {
      if (!doc) return;
      const chat = doc.getArray<ChatMessage>("chat");

      doc.transact(() => {
        chat.push([{ ...msg, id: crypto.randomUUID(), timestamp: Date.now() }]);
        const overflow = chat.length - MAX_MESSAGES;
        if (overflow > 0) chat.delete(0, overflow);
      });
    },
    [doc]
  );

  return { messages, send };
}