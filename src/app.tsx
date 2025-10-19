/** biome-ignore-all lint/correctness/useUniqueElementIds: it's alright */
import { useEffect, useState, useRef, useCallback } from "react";
import { useAgent } from "agents/react";
import { isToolUIPart } from "ai";
import { useAgentChat } from "agents/ai-react";
import type { UIMessage } from "@ai-sdk/react";
import type { tools } from "./tools";

// Component imports
import { Button } from "@/components/button/Button";
import { Card } from "@/components/card/Card";
import { Toggle } from "@/components/toggle/Toggle";
import { Textarea } from "@/components/textarea/Textarea";
import { MemoizedMarkdown } from "@/components/memoized-markdown";

// Icon imports
import {
  Bug,
  Moon,
  Sun,
  Trash,
  PaperPlaneTilt,
  Stop,
  X
} from "@phosphor-icons/react";

// List of tools that require human confirmation
// NOTE: this should match the tools that don't have execute functions in tools.ts
const toolsRequiringConfirmation: (keyof typeof tools)[] = [
  // All tools auto-execute
];

export default function Chat() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    // Check localStorage first, default to dark if not found
    const savedTheme = localStorage.getItem("theme");
    return (savedTheme as "dark" | "light") || "dark";
  });
  const [showDebug, setShowDebug] = useState(false);
  const [textareaHeight, setTextareaHeight] = useState("auto");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    // Apply theme class on mount and when theme changes
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    }

    // Save theme preference to localStorage
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Don't scroll on mount - only when messages change

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };

  const agent = useAgent({
    agent: "chat"
  });

  const [agentInput, setAgentInput] = useState("");
  const handleAgentInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setAgentInput(e.target.value);
  };

  const handleAgentSubmit = async (
    e: React.FormEvent,
    extraData: Record<string, unknown> = {}
  ) => {
    e.preventDefault();
    if (!agentInput.trim()) return;

    const message = agentInput;
    setAgentInput("");

    // Send message to agent
    await sendMessage(
      {
        role: "user",
        parts: [{ type: "text", text: message }]
      },
      {
        body: extraData
      }
    );
  };

  const {
    messages: agentMessages,
    clearHistory: clearLocalHistory,
    status,
    sendMessage,
    stop
  } = useAgentChat<unknown, UIMessage<{ createdAt: string }>>({
    agent
  });

  // Clear both local and server-side history
  const clearHistory = async () => {
    // Clear local state
    clearLocalHistory();
    
    // Clear server-side history
    try {
      const response = await fetch("/api/clear-history", { 
        method: "POST",
        credentials: "include" // Include cookies
      });
      
      if (!response.ok) {
        console.error("Failed to clear server history");
      }
    } catch (error) {
      console.error("Error clearing server history:", error);
    }
  };

  // Scroll to bottom when messages change (but not on initial load)
  useEffect(() => {
    if (agentMessages.length > 0) {
      scrollToBottom();
    }
  }, [agentMessages, scrollToBottom]);

  const pendingToolCallConfirmation = agentMessages.some((m: UIMessage) =>
    m.parts?.some(
      (part) =>
        isToolUIPart(part) &&
        part.state === "input-available" &&
        // Manual check inside the component
        toolsRequiringConfirmation.includes(
          part.type.replace("tool-", "") as keyof typeof tools
        )
    )
  );

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="h-[100vh] w-full max-[544px]:p-0 p-4 flex justify-center items-center bg-fixed overflow-hidden max-[544px]:bg-transparent bg-neutral-100 dark:max-[544px]:bg-transparent dark:bg-neutral-900">
      <div className="max-[544px]:h-[100vh] h-[calc(100vh-2rem)] w-full mx-auto max-w-lg flex flex-col max-[544px]:shadow-none shadow-xl max-[544px]:rounded-none rounded-2xl overflow-hidden relative max-[544px]:border-0 border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-950">
        <div className="px-4 py-3 border-b border-neutral-300 dark:border-neutral-800 flex items-center gap-3 sticky top-0 z-10 bg-white dark:bg-neutral-950">
          <img 
            src="/profile.jpg" 
            alt="Jules van der Toorn"
            className="w-10 h-10 rounded-full object-cover border border-neutral-200 dark:border-neutral-700"
          />

          <div className="flex-1 pt-1">
            <h2 className="font-semibold text-base">Jules van der Toorn</h2>
            <p className="text-xs text-muted-foreground -mt-0.5">Ask me anything!</p>
          </div>

          <div className="flex items-center gap-2 mr-2">
            <Bug size={16} />
            <Toggle
              toggled={showDebug}
              aria-label="Toggle debug mode"
              onClick={() => setShowDebug((prev) => !prev)}
            />
          </div>

          <Button
            variant="ghost"
            size="md"
            shape="square"
            className="rounded-full h-9 w-9"
            onClick={toggleTheme}
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </Button>

          <Button
            variant="ghost"
            size="md"
            shape="square"
            className="rounded-full h-9 w-9"
            onClick={clearHistory}
          >
            <Trash size={20} />
          </Button>
        </div>

        {/* Messages Container */}
          <div className="flex-1 relative">
            {/* Messages */}
            <div className={`absolute inset-0 overflow-y-auto p-4 space-y-1 ${showSuggestions ? 'pb-13' : 'pb-2'}`}>
            {agentMessages.length === 0 && (
            <div className="flex justify-center py-4">
              <Card className="p-7 max-w-md mx-auto bg-neutral-100 dark:bg-neutral-900 rounded-2xl">
                <div className="text-center space-y-1 text-[13px]">
                  <div className="text-4xl mb-2 pt-0">👋</div>
                  <p className="leading-relaxed pt-2">
                    Hi! I'm <span className="font-semibold text-[#F48120]">Jules' digital twin</span>, powered by Llama 3.3. 
                    I would love to intern at Cloudflare, 
                    so I built this chat to answer any questions you might have about me!
                  </p>
                  <p className="font-semibold text-[#F48120] pt-3">You can ask me...</p>
                  <ul className="text-left space-y-0 pt-0">
                    <li className="flex items-center gap-3">
                      <span className="text-[#F48120] text-lg">•</span>
                      <span>to elaborate on my work experience and skills 💼</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="text-[#F48120] text-lg">•</span>
                      <span>about my educational background 🎓</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="text-[#F48120] text-lg">•</span>
                      <span>to specify my internship availability 📅</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="text-[#F48120] text-lg">•</span>
                      <span>to share my CV or cover letter 📄</span>
                    </li>
                  </ul>
                  <p className="text-left pt-0.5">... and other things such as my hobbies and interests!</p>
                  <p className="text-xs text-muted-foreground italic pt-5">
                    Your conversation is private and automatically deleted after 7 days of inactivity.
                  </p>
                </div>
              </Card>
            </div>
          )}

          {agentMessages.map((m, index) => {
            const isUser = m.role === "user";
            
            // Filter out empty text parts (e.g., step-start with empty string)
            const hasVisibleContent = m.parts?.some((part) => {
              if (part.type === "text") {
                return part.text.trim().length > 0;
              }
              return true; // Keep tool invocations
            });
            
            // Skip rendering if no visible content
            if (!hasVisibleContent) {
              return null;
            }

            return (
              <div key={m.id}>
                {showDebug && (
                  <pre className="text-xs text-muted-foreground overflow-scroll">
                    {JSON.stringify(m, null, 2)}
                  </pre>
                )}
                <div
                  className={`flex ${isUser ? "justify-end" : "justify-start"} mb-0.5`}
                >
                  <div
                    className={`flex gap-2 max-w-[75%] ${
                      isUser ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    <div>
                      <div>
                        {m.parts?.map((part, i) => {
                          if (part.type === "text") {
                            // Skip empty text parts
                            if (part.text.trim().length === 0) {
                              return null;
                            }
                            
                            return (
                              // biome-ignore lint/suspicious/noArrayIndexKey: immutable index
                              <div key={i}>
                                <Card
                                  className={`p-3 rounded-2xl shadow-sm ${
                                    isUser
                                      ? "bg-[#F48120] text-white border-none"
                                      : "bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
                                  } ${
                                    part.text.startsWith("scheduled message")
                                      ? "border-accent/50"
                                      : ""
                                  } relative`}
                                >
                                  {part.text.startsWith(
                                    "scheduled message"
                                  ) && (
                                    <span className="absolute -top-3 -left-2 text-base">
                                      🕒
                                    </span>
                                  )}
                                  <div className={isUser ? "text-white" : ""}>
                                    <MemoizedMarkdown
                                      id={`${m.id}-${i}`}
                                      content={part.text.replace(
                                        /^scheduled message: /,
                                        ""
                                      )}
                                    />
                                  </div>
                                </Card>
                                <p
                                  className={`text-xs text-muted-foreground mt-1 px-2 ${
                                    isUser ? "text-right" : "text-left"
                                  }`}
                                >
                                  {formatTime(
                                    m.metadata?.createdAt
                                      ? new Date(m.metadata.createdAt)
                                      : new Date()
                                  )}
                                </p>
                              </div>
                            );
                          }

                          if (
                            isToolUIPart(part) &&
                            m.id.startsWith("assistant")
                          ) {
                            // Hide tool call invocations, but show tool results/outputs
                            if (part.state === "output-available" && part.output) {
                              // Render tool output as a regular message
                              const isUser = m.role === "user";
                              const outputText = typeof part.output === "string" 
                                ? part.output 
                                : JSON.stringify(part.output);
                              
                              return (
                                <div
                                  key={`${m.id}-${i}`}
                                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                                >
                                  <div className="max-w-[80%]">
                                    <Card
                                      className={`px-4 py-3 ${
                                        isUser
                                          ? "bg-orange-500 text-white"
                                          : "bg-white dark:bg-neutral-800"
                                      }`}
                                    >
                                      <div className={isUser ? "text-white" : ""}>
                                        <MemoizedMarkdown
                                          id={`${m.id}-${i}`}
                                          content={outputText}
                                        />
                                      </div>
                                    </Card>
                                    <p
                                      className={`text-xs text-muted-foreground mt-1 px-2 ${
                                        isUser ? "text-right" : "text-left"
                                      }`}
                                    >
                                      {formatTime(
                                        m.metadata?.createdAt
                                          ? new Date(m.metadata.createdAt)
                                          : new Date()
                                      )}
                                    </p>
                                  </div>
                                </div>
                              );
                            }
                            
                            // Hide all other tool states (input-available, running, etc.)
                            return null;
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
          </div>

          {/* Question Suggestions - Fixed to bottom of container */}
          {showSuggestions && (
            <div className="absolute bottom-0 left-0 right-0 pb-3 pointer-events-none">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pointer-events-auto px-3">
              <button
                onClick={async () => {
                  await sendMessage({
                    role: "user",
                    parts: [{ type: "text", text: "Why should we hire you?" }]
                  });
                }}
                className="px-4 py-2 rounded-full bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm border border-neutral-300 dark:border-neutral-700 text-sm whitespace-nowrap hover:bg-white dark:hover:bg-neutral-800 transition-colors"
              >
                Why should we hire you?
              </button>
              <button
                onClick={async () => {
                  await sendMessage({
                    role: "user",
                    parts: [{ type: "text", text: "What are your hobbies?" }]
                  });
                }}
                className="px-4 py-2 rounded-full bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm border border-neutral-300 dark:border-neutral-700 text-sm whitespace-nowrap hover:bg-white dark:hover:bg-neutral-800 transition-colors"
              >
                What are your hobbies?
              </button>
              <button
                onClick={async () => {
                  await sendMessage({
                    role: "user",
                    parts: [{ type: "text", text: "What are your socials?" }]
                  });
                }}
                className="px-4 py-2 rounded-full bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm border border-neutral-300 dark:border-neutral-700 text-sm whitespace-nowrap hover:bg-white dark:hover:bg-neutral-800 transition-colors"
              >
                What are your socials?
              </button>
                <button
                  onClick={() => setShowSuggestions(false)}
                  className="p-2 rounded-full bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm border border-neutral-300 dark:border-neutral-700 hover:bg-white dark:hover:bg-neutral-800 transition-colors shrink-0"
                  aria-label="Dismiss suggestions"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAgentSubmit(e, {
              annotations: {
                hello: "world"
              }
            });
            setTextareaHeight("auto"); // Reset height after submission
          }}
          className="p-3 bg-neutral-50 border-t border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 shrink-0"
        >
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Textarea
                disabled={pendingToolCallConfirmation}
                placeholder={
                  pendingToolCallConfirmation
                    ? "Please respond to the tool confirmation above..."
                    : "Send a message..."
                }
                className="flex w-full border border-neutral-200 dark:border-neutral-700 px-3 py-2  ring-offset-background placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-700 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-2xl !text-base pb-10 dark:bg-neutral-900"
                value={agentInput}
                onChange={(e) => {
                  handleAgentInputChange(e);
                  // Auto-resize the textarea
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                  setTextareaHeight(`${e.target.scrollHeight}px`);
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    handleAgentSubmit(e as unknown as React.FormEvent);
                    setTextareaHeight("auto"); // Reset height on Enter submission
                  }
                }}
                rows={2}
                style={{ height: textareaHeight }}
              />
              <div className="absolute bottom-0 right-0 p-2 w-fit flex flex-row justify-end">
                {status === "submitted" || status === "streaming" ? (
                  <button
                    type="button"
                    onClick={stop}
                    className="inline-flex items-center cursor-pointer justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full p-1.5 h-fit border border-neutral-200 dark:border-neutral-800"
                    aria-label="Stop generation"
                  >
                    <Stop size={16} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="inline-flex items-center cursor-pointer justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full p-1.5 h-fit border border-neutral-200 dark:border-neutral-800"
                    disabled={pendingToolCallConfirmation || !agentInput.trim()}
                    aria-label="Send message"
                  >
                    <PaperPlaneTilt size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
