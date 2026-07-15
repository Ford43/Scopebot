import { Link } from "react-router";
import {
  Sparkles,
  Zap,
  Plus,
  Mic,
  ImageIcon,
  Send,
  Bot,
  AlertTriangle,
  Settings,
  PenSquare,
} from "lucide-react";
import type { ChatMessage } from "../../types/chat";
import type { BotItem } from "../../types/bot";
import { SUGGESTED_PROMPTS, CATEGORY_COLORS } from "../../constants/chat";

interface ChatViewProps {
  activeBot: BotItem | null;
  messages: ChatMessage[];
  inputValue: string;
  isTyping: boolean;
  isAuthenticated: boolean;
  isWelcomeScreen: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onInputChange: (value: string) => void;
  onSend: (text?: string) => void;
  onNewChat: () => void;
  onEditBot: () => void;
}

export default function ChatView({
  activeBot,
  messages,
  inputValue,
  isTyping,
  isAuthenticated,
  isWelcomeScreen,
  textareaRef,
  messagesEndRef,
  onInputChange,
  onSend,
  onNewChat,
  onEditBot,
}: ChatViewProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center">
            {activeBot ? (
              <Bot className="w-4 h-4 text-gray-900" />
            ) : (
              <Zap className="w-4 h-4 text-gray-900" />
            )}
          </div>
          <div>
            <p className="text-sm text-gray-900" style={{ fontWeight: 600 }}>
              {activeBot ? activeBot.name : "scopebot"}
            </p>
            <p className="text-[11px] text-green-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse inline-block" />
              Online
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeBot && (
            <button
              onClick={onEditBot}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-amber-600 border border-gray-200 hover:border-amber-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              ตั้งค่าบอท
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

      <div className="flex-1 overflow-y-auto bg-gray-50">
        {isWelcomeScreen ? (
          <WelcomeScreen
            activeBot={activeBot}
            inputValue={inputValue}
            isTyping={isTyping}
            isAuthenticated={isAuthenticated}
            textareaRef={textareaRef}
            onInputChange={onInputChange}
            onSend={onSend}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <MessageList
            activeBot={activeBot}
            messages={messages}
            isTyping={isTyping}
            messagesEndRef={messagesEndRef}
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
              placeholder="พิมพ์ข้อความ..."
              rows={1}
              showSendLabel
            />
            {!isAuthenticated && (
              <div className="mt-2 flex items-center justify-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <p className="text-xs text-amber-600">
                  โหมด Guest — ประวัติแชทจะไม่ถูกบันทึก{" "}
                  <Link
                    to="/signup"
                    className="underline hover:text-amber-800"
                    style={{ fontWeight: 600 }}
                  >
                    สมัครสมาชิกฟรี
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WelcomeScreen({
  activeBot,
  inputValue,
  isTyping,
  isAuthenticated,
  textareaRef,
  onInputChange,
  onSend,
  onKeyDown,
}: {
  activeBot: BotItem | null;
  inputValue: string;
  isTyping: boolean;
  isAuthenticated: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onInputChange: (value: string) => void;
  onSend: (text?: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 pb-8">
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

      {!isAuthenticated && (
        <div className="w-full max-w-2xl mb-5">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-700 flex-1">
              คุณกำลังใช้งานในโหมด Guest — ประวัติการแชทจะ
              <strong>ไม่ถูกบันทึก</strong>
            </p>
            <Link
              to="/signup"
              className="text-xs bg-amber-400 hover:bg-amber-500 text-gray-900 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
              style={{ fontWeight: 600 }}
            >
              สมัครฟรี
            </Link>
          </div>
        </div>
      )}

      <div className="w-full max-w-2xl">
        <ChatInput
          inputValue={inputValue}
          isTyping={isTyping}
          textareaRef={textareaRef}
          onInputChange={onInputChange}
          onSend={onSend}
          onKeyDown={onKeyDown}
          placeholder="How can I help today? ..."
          rows={2}
          minHeight="56px"
        />
        <div className="mt-5">
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Suggested
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p.id}
                onClick={() =>
                  onSend(p.text.replace(/[📄💰🏢🖥️⏰🙋]/g, "").trim())
                }
                className="text-xs bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-full hover:border-amber-400 hover:text-amber-700 hover:bg-amber-50 transition-colors shadow-sm"
              >
                {p.text}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageList({
  activeBot,
  messages,
  isTyping,
  messagesEndRef,
}: {
  activeBot: BotItem | null;
  messages: ChatMessage[];
  isTyping: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
      {messages.map((message) => (
        <div key={message.id}>
          {message.sender === "bot" ? (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                {activeBot ? (
                  <Bot className="w-4 h-4 text-gray-900" />
                ) : (
                  <Zap className="w-4 h-4 text-gray-900" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs text-gray-400">{message.time}</span>
                  {message.category && (
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
                      : "bg-white border-gray-100 text-gray-800"
                  }`}
                >
                  {message.text}
                </div>
                {message.confidence && (
                  <p className="mt-1 text-[10px] text-gray-400 ml-1">
                    ความมั่นใจ: {Math.round(message.confidence * 100)}%
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <div>
                <div className="flex items-center justify-end gap-2 mb-1.5">
                  <span className="text-xs text-gray-400">{message.time}</span>
                </div>
                <div className="bg-gray-900 text-white rounded-2xl rounded-tr-none px-4 py-3 text-sm max-w-[85%] shadow-sm">
                  {message.text}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
      {isTyping && (
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center flex-shrink-0">
            {activeBot ? (
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
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <button className="text-gray-400 hover:text-gray-600 transition-colors">
            <Plus className="w-4 h-4" />
          </button>
          <button className="text-gray-400 hover:text-gray-600 transition-colors">
            <ImageIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-gray-400 hover:text-amber-500 transition-colors">
            <Mic className="w-4 h-4" />
          </button>
          <button
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
    </div>
  );
}
