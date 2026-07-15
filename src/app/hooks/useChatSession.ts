import { useEffect, useRef, useState, useCallback } from "react";
import type { ChatMessage, HistoryItem } from "../types/chat";
import type { BotItem } from "../types/bot";
import { authHeaders } from "../lib/api";
import { timeNow } from "../utils/date";

interface UseChatSessionOptions {
  isAuthenticated: boolean;
  activeBot: BotItem | null;
  isChatActive: boolean;
}

export function useChatSession({
  isAuthenticated,
  activeBot,
  isChatActive,
}: UseChatSessionOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);

  const currentSessionId = useRef(Date.now().toString());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  useEffect(() => {
    if (!activeBot || !isChatActive) return;

    const pollAdminReply = async () => {
      try {
        const res = await fetch(
          `/api/chat/${activeBot.bot_id}/session/${currentSessionId.current}/updates`
        );
        if (!res.ok) return;

        const newMsgs = await res.json();
        if (newMsgs.length === 0) return;

        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const msgsToAdd = newMsgs
            .filter((m: { id: number }) => !existingIds.has("staff-" + m.id))
            .map(
              (m: { id: number; message: string; created_at: string }) => ({
                id: "staff-" + m.id,
                sender: "bot" as const,
                text: `👩‍💻 [เจ้าหน้าที่]: ${m.message}`,
                time: new Date(m.created_at).toLocaleTimeString("th-TH", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                category: "Support",
              })
            );

          return msgsToAdd.length > 0 ? [...prev, ...msgsToAdd] : prev;
        });
      } catch (e) {
        console.error(e);
      }
    };

    const interval = setInterval(pollAdminReply, 3000);
    return () => clearInterval(interval);
  }, [activeBot, isChatActive]);

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? inputValue).trim();
      if (!text || isTyping) return;

      if (!activeBot?.bot_id) {
        alert("กรุณาเลือกบอทก่อนเริ่มการสนทนา");
        return;
      }

      const now = new Date();
      const timeStr = now.toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      });

      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), sender: "user", text, time: timeStr },
      ]);
      setInputValue("");
      setIsTyping(true);

      if (isAuthenticated) {
        setHistoryItems((prev) => [
          {
            id: Date.now().toString(),
            query: text,
            time: timeStr,
            timestamp: now.getTime(),
          },
          ...prev,
        ]);
      }

      try {
        const res = await fetch(`/api/chat/${activeBot.bot_id}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
          body: JSON.stringify({
            question: text,
            session_id: currentSessionId.current,
            source_channel: "web",
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.detail || "เกิดข้อผิดพลาดในการเชื่อมต่อกับบอท");
        }

        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "bot",
            text: data.answer || data.response || "ระบบไม่สามารถหาคำตอบได้",
            time: timeNow(),
          },
        ]);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
        console.error("Chat Error:", error);
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "bot",
            text: `❌ ขออภัย เกิดข้อผิดพลาด:\n${message}`,
            time: timeNow(),
            category: "Error",
          },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [inputValue, isTyping, activeBot, isAuthenticated]
  );

  const handleNewChat = useCallback(() => {
    currentSessionId.current = Date.now().toString();
    setMessages([]);
    setInputValue("");
  }, []);

  const resetSessionForBot = useCallback(() => {
    currentSessionId.current = Date.now().toString();
    setMessages([]);
    setInputValue("");
  }, []);

  return {
    messages,
    inputValue,
    setInputValue,
    isTyping,
    historyItems,
    setHistoryItems,
    messagesEndRef,
    textareaRef,
    handleSend,
    handleNewChat,
    resetSessionForBot,
  };
}
