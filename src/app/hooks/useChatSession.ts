import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import type { ChatMessage, ChatMode, HistoryItem } from "../types/chat";
import type { BotItem } from "../types/bot";
import { authHeaders } from "../lib/api";
import { timeNow } from "../utils/date";

interface UseChatSessionOptions {
  isAuthenticated: boolean;
  activeBot: BotItem | null;
  isChatActive: boolean;
}

function formatTime(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function asChatMode(value: unknown): ChatMode {
  if (value === "waiting" || value === "human" || value === "bot") return value;
  return "bot";
}

function messagesFromSession(session: {
  session_id: string;
  messages?: Array<{
    id: number;
    question: string;
    answer: string;
    created_at: string;
  }>;
}): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of session.messages || []) {
    out.push({
      id: `u-${m.id}`,
      sender: "user",
      text: m.question,
      time: formatTime(m.created_at),
    });
    out.push({
      id: `b-${m.id}`,
      sender: "bot",
      text: m.answer,
      time: formatTime(m.created_at),
    });
  }
  return out;
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
  const [chatMode, setChatMode] = useState<ChatMode>("bot");

  const currentSessionId = useRef(Date.now().toString());
  const chatModeRef = useRef<ChatMode>("bot");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyMode = useCallback((next: ChatMode, opts?: { ended?: boolean }) => {
    const prev = chatModeRef.current;
    chatModeRef.current = next;
    setChatMode(next);

    if (prev !== "human" && next === "human") {
      setMessages((msgs) => {
        if (msgs.some((m) => m.id === "system-staff-joined")) return msgs;
        return [
          ...msgs,
          {
            id: "system-staff-joined",
            sender: "staff",
            text: "เจ้าหน้าที่เข้ามาดูแลการสนทนานี้แล้ว",
            time: timeNow(),
            category: "system",
            senderName: "เจ้าหน้าที่",
          },
        ];
      });
    }

    if (
      (prev === "waiting" || prev === "human") &&
      next === "bot" &&
      opts?.ended
    ) {
      setMessages((msgs) => {
        if (msgs.some((m) => m.id === "system-ended")) return msgs;
        return [
          ...msgs,
          {
            id: "system-ended",
            sender: "bot",
            text: "เจ้าหน้าที่จบการสนทนาแล้ว บอทพร้อมให้บริการต่อ",
            time: timeNow(),
            category: "system",
          },
        ];
      });
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  const loadHistory = useCallback(async () => {
    if (!isAuthenticated) {
      setHistoryItems([]);
      return;
    }
    try {
      const qs = activeBot?.bot_id
        ? `?bot_id_filter=${encodeURIComponent(activeBot.bot_id)}&limit=30&scope=mine`
        : "?limit=30&scope=mine";
      const res = await fetch(`/api/chat/sessions/all${qs}`, {
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const sessions = await res.json();
      if (!Array.isArray(sessions)) return;

      setHistoryItems(
        sessions.map(
          (s: {
            session_id: string;
            bot_id?: string;
            title?: string;
            last_at?: string;
            started_at?: string;
            messages?: Array<{
              id: number;
              question: string;
              answer: string;
              created_at: string;
            }>;
          }) => {
            const ts = new Date(s.last_at || s.started_at || Date.now()).getTime();
            return {
              id: s.session_id,
              sessionId: s.session_id,
              botId: s.bot_id,
              query: s.title || s.messages?.[0]?.question || "การสนทนา",
              time: formatTime(s.last_at || s.started_at),
              timestamp: Number.isNaN(ts) ? Date.now() : ts,
              messages: messagesFromSession(s),
            } satisfies HistoryItem;
          }
        )
      );
    } catch (error) {
      console.error("Failed to load chat history", error);
    }
  }, [isAuthenticated, activeBot?.bot_id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!activeBot || !isChatActive) return;

    const pollAdminReply = async () => {
      try {
        const res = await fetch(
          `/api/chat/${activeBot.bot_id}/session/${currentSessionId.current}/updates`,
          { headers: authHeaders() }
        );
        if (!res.ok) return;

        const data = await res.json();
        const payload = Array.isArray(data)
          ? { mode: "bot" as const, is_active: true, messages: data }
          : data;
        const nextMode = asChatMode(payload.mode);
        applyMode(nextMode, { ended: payload.is_active === false });

        const incoming = Array.isArray(payload.messages) ? payload.messages : [];
        if (incoming.length === 0) return;

        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const msgsToAdd = incoming
            .filter((m: { id: string | number }) => !existingIds.has("staff-" + m.id))
            .map(
              (m: {
                id: string | number;
                message: string;
                sender_name?: string;
                created_at: string;
              }) => ({
                id: "staff-" + m.id,
                sender: "staff" as const,
                text: m.message,
                senderName: m.sender_name || "เจ้าหน้าที่",
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

    void pollAdminReply();
    const interval = setInterval(pollAdminReply, 3000);
    return () => clearInterval(interval);
  }, [activeBot, isChatActive, applyMode]);

  const restoreSession = useCallback((item: HistoryItem) => {
    if (item.sessionId) {
      currentSessionId.current = item.sessionId;
    }
    chatModeRef.current = "bot";
    setChatMode("bot");
    if (item.messages && item.messages.length > 0) {
      setMessages(item.messages);
    } else {
      setMessages([]);
    }
    setInputValue("");
  }, []);

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? inputValue).trim();
      if (!text || isTyping) return;

      if (!activeBot?.bot_id) {
        toast.error("กรุณาเลือกบอทก่อนเริ่มการสนทนา");
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

        const nextMode = asChatMode(data.session_mode);
        const prevMode = chatModeRef.current;
        applyMode(nextMode);

        const skipEcho =
          (prevMode === "waiting" || prevMode === "human") &&
          (nextMode === "waiting" || nextMode === "human") &&
          !data.offer_handoff;

        if (!skipEcho) {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              sender: nextMode === "human" ? "staff" : "bot",
              text: data.answer || data.response || "ระบบไม่สามารถหาคำตอบได้",
              time: timeNow(),
              sources: Array.isArray(data.sources) ? data.sources : undefined,
              offerHandoff: !!data.offer_handoff,
              category: data.offer_handoff ? "Support" : undefined,
            },
          ]);
        }
        if (isAuthenticated) {
          void loadHistory();
        }
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
    [inputValue, isTyping, activeBot, isAuthenticated, loadHistory, applyMode]
  );

  const handleContactStaff = useCallback(() => {
    if (chatModeRef.current !== "bot") return;
    void handleSend("ติดต่อเจ้าหน้าที่");
  }, [handleSend]);

  const handleNewChat = useCallback(() => {
    currentSessionId.current = Date.now().toString();
    chatModeRef.current = "bot";
    setChatMode("bot");
    setMessages([]);
    setInputValue("");
  }, []);

  const resetSessionForBot = useCallback(() => {
    currentSessionId.current = Date.now().toString();
    chatModeRef.current = "bot";
    setChatMode("bot");
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
    chatMode,
    handleSend,
    handleContactStaff,
    handleNewChat,
    resetSessionForBot,
    restoreSession,
  };
}
