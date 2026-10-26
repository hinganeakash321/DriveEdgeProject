"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { StructuredChatResponse } from "@/lib/types";

export type Msg =
  | { role: "user"; text: string }
  | { role: "assistant"; data: StructuredChatResponse };

interface ChatStore {
  messages: Msg[];
  setMessages: React.Dispatch<React.SetStateAction<Msg[]>>;
  conversationId: number | null;
  setConversationId: (id: number | null) => void;
  resetChat: () => void;
}

const ChatContext = createContext<ChatStore | undefined>(undefined);

/**
 * In-memory chat store lifted to the root layout. Because it lives above the
 * router outlet, the conversation survives in-app navigation (soft routing) but
 * is naturally discarded on a full browser refresh - no browser storage is used.
 */
export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);

  const resetChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
  }, []);

  return (
    <ChatContext.Provider
      value={{ messages, setMessages, conversationId, setConversationId, resetChat }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatStore() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatStore must be used within ChatProvider");
  return ctx;
}
