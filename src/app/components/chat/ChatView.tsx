import {
  Sparkles,
  Zap,
  Send,
  Bot,
  Settings,
  PenSquare,
  FileText,
  ArrowLeft,
  Headphones,
  Handshake,
} from "lucide-react";
import type { ChatMessage, ChatMode } from "../../types/chat";
import type { BotItem } from "../../types/bot";
import { CATEGORY_COLORS } from "../../constants/chat";

interface ChatViewProps {
  activeBot: BotItem | null;
  messages: ChatMessage[];
  inputValue: string;
  isTyping: boolean;
  isWelcomeScreen: boolean;
  chatMode: ChatMode;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onInputChange: (value: string) => void;
  onSend: (text?: string) => void;
  onNewChat: () => void;
  onEditBot: () => void;
  onBackToBots: () => void;
  onContactStaff: () => void;
}

export default function ChatView({
  activeBot,
  messages,
  inputValue,
  isTyping,
  isWelcomeScreen,
  chatMode,
  textareaRef,
  messagesEndRef,
  onInputChange,
  onSend,
  onNewChat,
  onEditBot,
  onBackToBots,
  onContactStaff,
}: ChatViewProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const status = statusForMode(chatMode);
  const withStaff = chatMode === "waiting" || chatMode === "human";

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between flex-shrink-0 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToBots}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-amber-600 border border-gray-200 hover:border-amber-300 px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">กลับไปจัดการบอท</span>
            <span className="sm:hidden">กลับ</span>
          </button>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              chatMode === "human"
                ? "bg-sky-500"
                : chatMode === "waiting"
                  ? "bg-amber-400"
                  : "bg-amber-400"
            }`}
          >
            {chatMode === "human" ? (
              <Headphones className="w-4 h-4 text-white" />
            ) : activeBot ? (
              <Bot className="w-4 h-4 text-gray-900" />
            ) : (
              <Zap className="w-4 h-4 text-gray-900" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-gray-900 truncate" style={{ fontWeight: 600 }}>
              {chatMode === "human"
                ? "เจ้าหน้าที่"
                : activeBot
                  ? activeBot.name
                  : "scopebot"}
            </p>
            <p
              className={`text-[11px] flex items-center gap-1 ${status.color}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full inline-block ${status.dot} ${
                  chatMode === "waiting" ? "" : "animate-pulse"
                }`}
              />
              {status.label}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {activeBot && (
            <button
              onClick={onEditBot}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-amber-600 border border-gray-200 hover:border-amber-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ตั้งค่าบอท</span>
            </button>
          )}
          <button
            onClick={onNewChat}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-amber-600 border border-gray-200 hover:border-amber-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            <PenSquare className="w-3.5 h-3.5" />
            แชทใหม่
          </button>
        </div>
      </div>

      <ModeBanner chatMode={chatMode} />

      <div className="flex-1 overflow-y-auto bg-gray-50">
        {isWelcomeScreen ? (
          <WelcomeScreen
            activeBot={activeBot}
            inputValue={inputValue}
            isTyping={isTyping}
            textareaRef={textareaRef}
            onInputChange={onInputChange}
            onSend={onSend}
            onKeyDown={handleKeyDown}
            onContactStaff={onContactStaff}
          />
        ) : (
          <MessageList
            activeBot={activeBot}
            messages={messages}
            isTyping={isTyping}
            chatMode={chatMode}
            messagesEndRef={messagesEndRef}
            onContactStaff={onContactStaff}
          />
        )}
      </div>

      {!isWelcomeScreen && (
        <div className="border-t border-gray-200 bg-white px-6 py-4 flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            <ChatInput
              inputValue={inputValue}
              isTyping={isTyping}
              textareaRef={textareaRef}
              onInputChange={onInputChange}
              onSend={onSend}
              onKeyDown={handleKeyDown}
              placeholder={
                chatMode === "waiting"
                  ? "รอเจ้าหน้าที่เข้ามาดูแล — พิมพ์ข้อความได้เลย"
                  : chatMode === "human"
                    ? "พิมพ์ข้อความถึงเจ้าหน้าที่..."
                    : "พิมพ์ข้อความ..."
              }
              rows={1}
              showSendLabel
              showContactStaff={!withStaff}
              onContactStaff={onContactStaff}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function statusForMode(mode: ChatMode) {
  if (mode === "human") {
    return {
      label: "กำลังคุยกับเจ้าหน้าที่",
      color: "text-sky-600",
      dot: "bg-sky-500",
    };
  }
  if (mode === "waiting") {
    return {
      label: "รอเจ้าหน้าที่รับเรื่อง",
      color: "text-amber-600",
      dot: "bg-amber-500",
    };
  }
  return {
    label: "กำลังคุยกับบอท • Online",
    color: "text-green-600",
    dot: "bg-green-400",
  };
}

function ModeBanner({ chatMode }: { chatMode: ChatMode }) {
  if (chatMode === "human") {
    return (
      <div className="flex items-center gap-2 px-4 sm:px-6 py-2 bg-sky-50 border-b border-sky-100 text-sky-800 text-xs flex-shrink-0">
        <Headphones className="w-3.5 h-3.5 flex-shrink-0" />
        คุณกำลังคุยกับเจ้าหน้าที่ ไม่ใช่บอท — ข้อความจะถูกส่งถึงเจ้าหน้าที่โดยตรง
      </div>
    );
  }
  if (chatMode === "waiting") {
    return (
      <div className="flex items-center gap-2 px-4 sm:px-6 py-2 bg-amber-50 border-b border-amber-100 text-amber-800 text-xs flex-shrink-0">
        <Handshake className="w-3.5 h-3.5 flex-shrink-0" />
        กำลังรอเจ้าหน้าที่เข้ามาดูแล คิวถูกส่งไปที่หน้าแชทรวมแล้ว
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-4 sm:px-6 py-2 bg-emerald-50/80 border-b border-emerald-100 text-emerald-800 text-xs flex-shrink-0">
      <Bot className="w-3.5 h-3.5 flex-shrink-0" />
      คุณกำลังคุยกับบอทอัตโนมัติ หากตอบไม่ได้ สามารถกดติดต่อเจ้าหน้าที่ได้
    </div>
  );
}

function WelcomeScreen({
  activeBot,
  inputValue,
  isTyping,
  textareaRef,
  onInputChange,
  onSend,
  onKeyDown,
  onContactStaff,
}: {
  activeBot: BotItem | null;
  inputValue: string;
  isTyping: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onInputChange: (value: string) => void;
  onSend: (text?: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onContactStaff: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 sm:px-6 pb-8">
      <div className="w-20 h-20 bg-amber-400 rounded-3xl flex items-center justify-center mb-5 shadow-lg shadow-amber-200">
        {activeBot ? (
          <Bot className="w-10 h-10 text-gray-900" />
        ) : (
          <Zap className="w-10 h-10 text-gray-900" />
        )}
      </div>
      <h1 className="text-gray-900 mb-2 text-center">
        Welcome to {activeBot ? activeBot.name : "scopebot"}
      </h1>
      <p className="text-sm text-gray-500 text-center max-w-md leading-relaxed mb-8">
        {activeBot
          ? activeBot.description
          : "ผู้ช่วยดิจิทัลอัจฉริยะ พร้อมให้บริการข้อมูลและความช่วยเหลือด้วยความเป็นมิตร"}
      </p>

      <div className="w-full max-w-2xl">
        <ChatInput
          inputValue={inputValue}
          isTyping={isTyping}
          textareaRef={textareaRef}
          onInputChange={onInputChange}
          onSend={onSend}
          onKeyDown={onKeyDown}
          placeholder="พิมพ์คำถามของคุณ..."
          rows={2}
          minHeight="56px"
          showContactStaff
          onContactStaff={onContactStaff}
        />
      </div>
    </div>
  );
}

function MessageList({
  activeBot,
  messages,
  isTyping,
  chatMode,
  messagesEndRef,
  onContactStaff,
}: {
  activeBot: BotItem | null;
  messages: ChatMessage[];
  isTyping: boolean;
  chatMode: ChatMode;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onContactStaff: () => void;
}) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
      {messages.map((message) => {
        if (message.category === "system") {
          return (
            <div key={message.id} className="flex justify-center">
              <span className="text-[11px] text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm">
                {message.text}
              </span>
            </div>
          );
        }

        if (message.sender === "user") {
          return (
            <div key={message.id} className="flex justify-end">
              <div>
                <div className="flex items-center justify-end gap-2 mb-1.5">
                  <span className="text-xs text-gray-400">{message.time}</span>
                </div>
                <div className="bg-gray-900 text-white rounded-2xl rounded-tr-none px-4 py-3 text-sm max-w-[85%] shadow-sm">
                  {message.text}
                </div>
              </div>
            </div>
          );
        }

        const isStaff = message.sender === "staff";
        return (
          <div key={message.id} className="flex items-start gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                isStaff ? "bg-sky-500" : "bg-amber-400"
              }`}
            >
              {isStaff ? (
                <Headphones className="w-4 h-4 text-white" />
              ) : activeBot ? (
                <Bot className="w-4 h-4 text-gray-900" />
              ) : (
                <Zap className="w-4 h-4 text-gray-900" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className={`text-[11px] ${isStaff ? "text-sky-700" : "text-gray-500"}`}
                  style={{ fontWeight: 600 }}
                >
                  {isStaff
                    ? message.senderName || "เจ้าหน้าที่"
                    : activeBot?.name || "บอท"}
                </span>
                <span className="text-xs text-gray-400">{message.time}</span>
                {message.category && message.category !== "Support" && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${CATEGORY_COLORS[message.category] ?? "bg-gray-100 text-gray-500"}`}
                  >
                    {message.category}
                  </span>
                )}
                {message.confidence && message.confidence > 0.8 && (
                  <Sparkles className="w-3 h-3 text-amber-400" />
                )}
              </div>
              <div
                className={`rounded-2xl rounded-tl-none px-4 py-3 text-sm whitespace-pre-line shadow-sm border max-w-[85%] ${
                  message.category === "Error"
                    ? "bg-red-50 border-red-200 text-red-700"
                    : isStaff
                      ? "bg-sky-50 border-sky-100 text-gray-800"
                      : "bg-white border-gray-100 text-gray-800"
                }`}
              >
                {message.text}
              </div>
              {message.offerHandoff && chatMode === "bot" && (
                <button
                  type="button"
                  onClick={onContactStaff}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                  style={{ fontWeight: 600 }}
                >
                  <Headphones className="w-3.5 h-3.5" />
                  ติดต่อเจ้าหน้าที่
                </button>
              )}
              {message.sources && message.sources.length > 0 && (
                <div className="mt-2 max-w-[85%] space-y-1.5">
                  <p className="text-[10px] text-gray-400 flex items-center gap-1 ml-1">
                    <FileText className="w-3 h-3" />
                    อ้างอิงจากเอกสาร
                  </p>
                  {message.sources.map((s) => (
                    <div
                      key={s.filename + (s.snippet || "")}
                      className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2"
                    >
                      <p
                        className="text-[11px] text-amber-800 truncate"
                        style={{ fontWeight: 600 }}
                      >
                        {s.filename}
                      </p>
                      {s.snippet && (
                        <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">
                          {s.snippet}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {message.confidence && (
                <p className="mt-1 text-[10px] text-gray-400 ml-1">
                  ความมั่นใจ: {Math.round(message.confidence * 100)}%
                </p>
              )}
            </div>
          </div>
        );
      })}
      {isTyping && (
        <div className="flex items-start gap-3">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              chatMode === "human" ? "bg-sky-500" : "bg-amber-400"
            }`}
          >
            {chatMode === "human" ? (
              <Headphones className="w-4 h-4 text-white" />
            ) : activeBot ? (
              <Bot className="w-4 h-4 text-gray-900" />
            ) : (
              <Zap className="w-4 h-4 text-gray-900" />
            )}
          </div>
          <div className="bg-white rounded-2xl rounded-tl-none px-4 py-3 shadow-sm border border-gray-100">
            <div className="flex gap-1 items-center h-4">
              <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" />
              <div
                className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce"
                style={{ animationDelay: "0.2s" }}
              />
              <div
                className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce"
                style={{ animationDelay: "0.4s" }}
              />
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

function ChatInput({
  inputValue,
  isTyping,
  textareaRef,
  onInputChange,
  onSend,
  onKeyDown,
  placeholder,
  rows,
  minHeight,
  showSendLabel,
  showContactStaff,
  onContactStaff,
}: {
  inputValue: string;
  isTyping: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  rows: number;
  minHeight?: string;
  showSendLabel?: boolean;
  showContactStaff?: boolean;
  onContactStaff?: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border-2 border-amber-400 shadow-md shadow-amber-100 px-4 pt-4 pb-3">
      <textarea
        ref={textareaRef}
        value={inputValue}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={`w-full resize-none outline-none text-sm text-gray-700 placeholder-gray-400 ${minHeight ? `min-h-[${minHeight}]` : ""} max-h-40`}
        style={minHeight ? { minHeight } : undefined}
      />
      <div className="flex items-center justify-between pt-2 gap-2">
        {showContactStaff && onContactStaff ? (
          <button
            type="button"
            onClick={onContactStaff}
            disabled={isTyping}
            className="flex items-center gap-1.5 text-xs text-sky-700 hover:text-sky-900 border border-sky-200 hover:bg-sky-50 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40"
          >
            <Headphones className="w-3.5 h-3.5" />
            ติดต่อเจ้าหน้าที่
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onSend}
          disabled={!inputValue.trim() || isTyping}
          className={
            showSendLabel
              ? "flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-gray-900 text-xs transition-colors disabled:opacity-40"
              : "w-8 h-8 rounded-lg bg-amber-400 hover:bg-amber-500 flex items-center justify-center text-gray-900 transition-colors disabled:opacity-40"
          }
          style={showSendLabel ? { fontWeight: 600 } : undefined}
        >
          <Send className="w-3.5 h-3.5" />
          {showSendLabel && "ส่ง"}
        </button>
      </div>
    </div>
  );
}
