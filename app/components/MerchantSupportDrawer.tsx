import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  Text,
  Badge,
  Button,
  InlineStack,
  BlockStack,
  Spinner,
  Divider,
} from "@shopify/polaris";

interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  category?: string;
  suggestedFollowups?: string[];
  timestamp: string;
}

interface MerchantSupportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  shop?: string;
}

const QUICK_CHIPS = [
  {
    icon: "📌",
    label: "How does automatic inventory restock work?",
    query: "How does automatic inventory restock work?",
  },
  {
    icon: "💳",
    label: "Explain the 7-day trial and billing rollover",
    query: "Explain the 7-day trial and billing rollover",
  },
  {
    icon: "📍",
    label: "How do customers drop their GPS location pin?",
    query: "How do customers drop their GPS location pin?",
  },
  {
    icon: "⚡",
    label: "Check my current plan & quota status",
    query: "Check my current plan & quota status",
  },
];

/**
 * Lightweight in-component markdown formatter to safely render headers,
 * bold text, bullet points, inline code, and URLs without external library dependencies.
 */
function MarkdownRenderer({ content }: { content: string }) {
  const blocks = content.split(/\n\n+/);

  const renderInline = (str: string): React.ReactNode[] => {
    // Regex for bold **text**, inline code `code`, and links [label](url)
    const regex = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
    const parts = str.split(regex);

    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={idx}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={idx}
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.06)",
              padding: "2px 5px",
              borderRadius: "4px",
              fontSize: "0.9em",
              fontFamily: "monospace",
            }}
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        return (
          <a
            key={idx}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#005bd3", textDecoration: "underline" }}
          >
            {linkMatch[1]}
          </a>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  return (
    <BlockStack gap="200">
      {blocks.map((block, bIdx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Header ###
        if (trimmed.startsWith("### ")) {
          return (
            <Box key={bIdx} paddingBlockStart="100" paddingBlockEnd="050">
              <Text as="h4" variant="headingSm">
                {trimmed.replace(/^###\s*/, "")}
              </Text>
            </Box>
          );
        }

        // Bullet lists
        const lines = trimmed.split("\n");
        const isBulletList = lines.every(
          (line) =>
            line.trim().startsWith("•") ||
            line.trim().startsWith("-") ||
            line.trim().startsWith("* ") ||
            /^\d+\./.test(line.trim()) ||
            line.trim() === "",
        );

        if (isBulletList && lines.length > 0) {
          return (
            <ul
              key={bIdx}
              style={{
                margin: "4px 0",
                paddingLeft: "20px",
                listStyleType: "disc",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              {lines
                .filter((l) => l.trim().length > 0)
                .map((line, lIdx) => {
                  const cleaned = line
                    .trim()
                    .replace(/^(•|-|\*|\d+\.)\s*/, "");
                  return (
                    <li key={lIdx} style={{ fontSize: "13px", lineHeight: "1.5" }}>
                      {renderInline(cleaned)}
                    </li>
                  );
                })}
            </ul>
          );
        }

        // Standard paragraph
        return (
          <div
            key={bIdx}
            style={{
              fontSize: "13px",
              lineHeight: "1.5",
              color: "#202223",
              whiteSpace: "pre-wrap",
            }}
          >
            {lines.map((l, lIdx) => (
              <React.Fragment key={lIdx}>
                {renderInline(l)}
                {lIdx < lines.length - 1 && <br />}
              </React.Fragment>
            ))}
          </div>
        );
      })}
    </BlockStack>
  );
}

export function MerchantSupportDrawer({
  isOpen,
  onClose,
  shop,
}: MerchantSupportDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init-1",
      sender: "assistant",
      text: `👋 **Welcome to SwiftCOD 24/7 Diagnostic Copilot!**

I am autonomously grounded in your real-time store telemetry and ready to assist you with:
• **Billing & Plans:** 7-Day free trial, plan limits, and recurring deductions.
• **GraphQL Restock:** Automated catalog restocking when buyers cancel.
• **WhatsApp GPS:** Pin drop extraction and Shopify Order Timeline notes.
• **Diagnostics:** Instant troubleshooting for failed message deliveries.

Click any suggestion below or ask me a custom question!`,
      category: "general",
      suggestedFollowups: [
        "Check my current plan & quota status",
        "Explain the 7-day trial and billing rollover",
        "How does automatic inventory restock work?",
        "How do customers drop their GPS location pin?",
      ],
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  ]);

  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom of chat thread when messages change
  useEffect(() => {
    if (isOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isOpen]);

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isOpen]);

  const handleSendMessage = async (queryToSend?: string) => {
    const rawText = queryToSend ?? inputQuery;
    const trimmed = rawText.trim();
    if (!trimmed || isLoading) return;

    const userMessageId = `user-${Date.now()}`;
    const userMsg: Message = {
      id: userMessageId,
      sender: "user",
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/support/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Server responded with status ${response.status}`,
        );
      }

      const data = await response.json();

      const assistantMsg: Message = {
        id: `assist-${Date.now()}`,
        sender: "assistant",
        text: data.reply || "I couldn't process this request. Please try again.",
        category: data.category || "general",
        suggestedFollowups: data.suggestedFollowups || [],
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        sender: "assistant",
        text: `⚠️ **Unable to complete inquiry:** ${err.message || "Network error"}. Please check your connection or retry.`,
        category: "troubleshooting",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopy = (id: string, text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          zIndex: 99998,
          transition: "opacity 0.25s ease-in-out",
        }}
      />

      {/* Slide-over Drawer Panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "480px",
          maxWidth: "100vw",
          backgroundColor: "#ffffff",
          boxShadow: "-4px 0 24px rgba(0, 0, 0, 0.15)",
          zIndex: 99999,
          display: "flex",
          flexDirection: "column",
          animation: "slideInRight 0.25s ease-out",
        }}
      >
        {/* Inline style for animation */}
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>

        {/* 1. Drawer Header */}
        <Box
          padding="400"
          background="bg-surface-secondary"
          borderBlockEndWidth="025"
          borderColor="border"
        >
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="200" blockAlign="center">
              <span style={{ fontSize: "20px" }}>💬</span>
              <BlockStack gap="050">
                <InlineStack gap="150" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    24/7 Support Copilot
                  </Text>
                  <Badge tone="success">Online</Badge>
                </InlineStack>
                <Text as="span" variant="bodyXs" tone="subdued">
                  Grounded in live store telemetry &amp; Shopify GraphQL
                </Text>
              </BlockStack>
            </InlineStack>

            <Button onClick={onClose} variant="plain">
              ✕
            </Button>
          </InlineStack>
        </Box>

        {/* 2. Quick Action Chips Bar */}
        <Box
          padding="300"
          background="bg-surface-tertiary"
          borderBlockEndWidth="025"
          borderColor="border"
        >
          <BlockStack gap="150">
            <Text as="span" variant="bodyXs" tone="subdued" fontWeight="semibold">
              QUICK RESOLUTION SHORTCUTS:
            </Text>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
              }}
            >
              {QUICK_CHIPS.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(chip.query)}
                  disabled={isLoading}
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #c9cccf",
                    borderRadius: "16px",
                    padding: "5px 10px",
                    fontSize: "11px",
                    fontWeight: 500,
                    cursor: isLoading ? "not-allowed" : "pointer",
                    color: "#202223",
                    textAlign: "left",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    transition: "all 0.15s ease-in-out",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#f1f2f4";
                    e.currentTarget.style.borderColor = "#8c9196";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#ffffff";
                    e.currentTarget.style.borderColor = "#c9cccf";
                  }}
                >
                  <span>{chip.icon}</span>
                  <span>{chip.label}</span>
                </button>
              ))}
            </div>
          </BlockStack>
        </Box>

        {/* 3. Message Thread Scrollable Container */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            backgroundColor: "#f6f6f7",
          }}
        >
          {messages.map((msg) => {
            const isUser = msg.sender === "user";

            return (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isUser ? "flex-end" : "flex-start",
                  width: "100%",
                }}
              >
                {/* Bubble Wrapper */}
                <div
                  style={{
                    maxWidth: "88%",
                    borderRadius: isUser
                      ? "14px 14px 2px 14px"
                      : "14px 14px 14px 2px",
                    padding: "12px 14px",
                    backgroundColor: isUser ? "#005bd3" : "#ffffff",
                    color: isUser ? "#ffffff" : "#202223",
                    boxShadow: isUser
                      ? "0 1px 3px rgba(0,91,211,0.2)"
                      : "0 1px 4px rgba(0,0,0,0.08)",
                    border: isUser ? "none" : "1px solid #e1e3e5",
                  }}
                >
                  {!isUser && (
                    <div
                      style={{
                        marginBottom: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                      }}
                    >
                      <InlineStack gap="150" blockAlign="center">
                        <span style={{ fontSize: "14px" }}>🤖</span>
                        <Text as="span" variant="bodyXs" fontWeight="bold">
                          SwiftCOD Copilot
                        </Text>
                        {msg.category && (
                          <Badge
                            tone={
                              msg.category === "billing"
                                ? "attention"
                                : msg.category === "restock"
                                  ? "success"
                                  : msg.category === "location"
                                    ? "info"
                                    : msg.category === "quota"
                                      ? "warning"
                                      : undefined
                            }
                          >
                            {msg.category.toUpperCase()}
                          </Badge>
                        )}
                      </InlineStack>

                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.text)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "11px",
                          color: copiedId === msg.id ? "#008060" : "#6d7175",
                          fontWeight: 500,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "2px",
                          padding: "2px 4px",
                        }}
                        title="Copy solution text to clipboard"
                      >
                        {copiedId === msg.id ? "✓ Copied" : "📋 Copy Solution"}
                      </button>
                    </div>
                  )}

                  {isUser ? (
                    <div style={{ fontSize: "13px", lineHeight: "1.4" }}>
                      {msg.text}
                    </div>
                  ) : (
                    <MarkdownRenderer content={msg.text} />
                  )}

                  {/* Suggested Followups */}
                  {!isUser &&
                    msg.suggestedFollowups &&
                    msg.suggestedFollowups.length > 0 && (
                      <div
                        style={{
                          marginTop: "12px",
                          paddingTop: "8px",
                          borderTop: "1px dashed #e1e3e5",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                        }}
                      >
                        <Text as="span" variant="bodyXs" tone="subdued">
                          Suggested follow-ups:
                        </Text>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "4px",
                          }}
                        >
                          {msg.suggestedFollowups.map((followup, fIdx) => (
                            <button
                              key={fIdx}
                              type="button"
                              onClick={() => handleSendMessage(followup)}
                              disabled={isLoading}
                              style={{
                                background: "#f1f2f4",
                                border: "1px solid #d2d5d8",
                                borderRadius: "12px",
                                padding: "3px 8px",
                                fontSize: "11px",
                                color: "#005bd3",
                                cursor: isLoading ? "not-allowed" : "pointer",
                                textAlign: "left",
                              }}
                            >
                              ↳ {followup}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                </div>

                <div
                  style={{
                    fontSize: "10px",
                    color: "#8c9196",
                    marginTop: "3px",
                    paddingInline: "4px",
                  }}
                >
                  {msg.timestamp}
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isLoading && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                backgroundColor: "#ffffff",
                borderRadius: "12px",
                border: "1px solid #e1e3e5",
                width: "fit-content",
              }}
            >
              <Spinner size="small" />
              <Text as="span" variant="bodySm" tone="subdued">
                Copilot is inspecting real-time store telemetry...
              </Text>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        <Divider />

        {/* 4. Bottom Input Bar */}
        <Box padding="300" background="bg-surface">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask anything (e.g. 'How does restock work?', 'Check my quota')..."
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid #8c9196",
                fontSize: "13px",
                outline: "none",
                fontFamily: "inherit",
              }}
            />

            <Button
              variant="primary"
              onClick={() => handleSendMessage()}
              disabled={!inputQuery.trim() || isLoading}
              loading={isLoading}
            >
              Send
            </Button>
          </div>
          <Box paddingBlockStart="150">
            <InlineStack align="space-between">
              <Text as="span" variant="bodyXs" tone="subdued">
                Press Enter to send inquiry
              </Text>
              <Text as="span" variant="bodyXs" tone="subdued">
                Enterprise Autonomous Copilot v2.4
              </Text>
            </InlineStack>
          </Box>
        </Box>
      </div>
    </>
  );
}
