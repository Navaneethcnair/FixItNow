'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Job, TRADE_CONFIG, TradeType } from '@/lib/types';
import { SparklesIcon } from '@/components/Icons';
import styles from './AiChatModal.module.css';

interface AiChatModalProps {
  job: Job | null;
}

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
}

// Markdown parser converting bold (**text**), bullet lists (• / -), numbered lists, and paragraphs into formatted React elements
function renderFormattedMessage(text: string) {
  const lines = text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);

  const elements: React.ReactNode[] = [];
  let currentListType: 'ul' | 'ol' | null = null;
  let currentListItems: React.ReactNode[] = [];

  const parseInlineBold = (str: string): React.ReactNode => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} style={{ fontWeight: 800, color: 'inherit' }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  const flushList = (keySuffix: string | number) => {
    if (currentListType && currentListItems.length > 0) {
      if (currentListType === 'ul') {
        elements.push(
          <ul key={`ul-${keySuffix}`} style={{ paddingLeft: '20px', margin: '6px 0' }}>
            {currentListItems}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`ol-${keySuffix}`} style={{ paddingLeft: '20px', margin: '6px 0' }}>
            {currentListItems}
          </ol>
        );
      }
      currentListType = null;
      currentListItems = [];
    }
  };

  lines.forEach((line, idx) => {
    const isBullet = line.startsWith('•') || line.startsWith('-') || line.startsWith('*');
    const isNumbered = /^\d+\.\s/.test(line);

    if (isBullet || isNumbered) {
      const listType: 'ul' | 'ol' = isNumbered ? 'ol' : 'ul';
      const cleanContent = line.replace(/^([•\-\*]|\d+\.)\s*/, '');
      const parsedContent = parseInlineBold(cleanContent);

      if (currentListType !== listType) {
        flushList(idx);
        currentListType = listType;
      }
      currentListItems.push(
        <li key={`item-${idx}`} style={{ marginBottom: '4px' }}>
          {parsedContent}
        </li>
      );
    } else {
      flushList(idx);
      elements.push(
        <p key={idx} style={{ margin: '6px 0', lineHeight: '1.6' }}>
          {parseInlineBold(line)}
        </p>
      );
    }
  });

  flushList('end');
  return elements;
}

export default function AiChatModal({ job }: AiChatModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [hasAskedAnyQuestion, setHasAskedAnyQuestion] = useState(false);

  const tradeKey = (job?.ai_trade_required as TradeType) || 'other';
  const tradeConfig = TRADE_CONFIG[tradeKey] || TRADE_CONFIG.other;
  const tradeLabel = tradeConfig.label.toLowerCase();

  const problemTitle = job?.ai_problem_title || `${tradeConfig.label} Maintenance Issue`;

  const initialMessageText = `Hello! I've analyzed your ${problemTitle}. Feel free to ask me any questions about DIY safety, tools & materials required, cost estimates, or step-by-step repair guidance!`;

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'ai',
      text: initialMessageText,
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputText.trim();
    if (!query || isThinking) return;

    // Permanently hide prompt suggestion chips once any question is asked
    setHasAskedAnyQuestion(true);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setIsThinking(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          jobContext: {
            problem_title: job?.ai_problem_title,
            trade_required: tradeConfig.label,
            severity: job?.ai_severity,
            description: job?.ai_description,
            dimension: job?.ai_dimension,
            location: job?.location_address,
            solution_steps: job?.specialized_metrics?.solution_steps,
            worker_instructions: job?.worker_instructions,
          },
          history: messages.slice(-6).map((m) => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.text,
          })),
        }),
      });

      const data = await res.json();
      if (res.ok && data.reply) {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: data.reply,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        throw new Error(data.error || 'No response');
      }
    } catch (err) {
      console.warn('AI Chat request error:', err);
      const fallbackAiMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        sender: 'ai',
        text: `I've analyzed your **${problemTitle}**.\n\n• **Recommendation:** Book a certified ${tradeConfig.label} to verify structural connections.\n• **Safety:** Shut off main utility lines before attempting manual repairs.`,
      };
      setMessages((prev) => [...prev, fallbackAiMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleChipClick = (questionText: string) => {
    handleSendMessage(questionText);
  };

  // Quick Action suggestion chips matching exact Image 4 design
  const suggestionChips = [
    {
      id: 'chip-contain',
      icon: (
        <span className={styles.chipYellowIcon}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26C17.81 13.47 19 11.38 19 9a7 7 0 0 0-7-7z" />
          </svg>
        </span>
      ),
      text: `How to temporarily contain this ${tradeLabel} issue?`,
    },
    {
      id: 'chip-tools',
      icon: (
        <span className={styles.chipBlueIcon}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </span>
      ),
      text: `What exact tools & materials are required?`,
    },
    {
      id: 'chip-cost',
      icon: (
        <span className={styles.chipGreenIcon}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </span>
      ),
      text: `Estimated repair cost & labor charges`,
    },
    {
      id: 'chip-safety',
      icon: (
        <span className={styles.chipPinkIcon}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </span>
      ),
      text: `What safety precautions should I take now?`,
    },
  ];

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          className={styles.triggerBtn}
          onClick={() => setIsOpen(true)}
          title="Open FixItNow AI Assistant Chat"
          aria-label="Chat with AI"
        >
          <SparklesIcon size={18} />
          <span>Chat with AI</span>
          <span className={styles.onlineDot} />
        </button>
      )}

      {/* Interactive AI Chat Modal Window */}
      {isOpen && (
        <div className={styles.modalContainer}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <div className={styles.headerAvatar}>
                <SparklesIcon size={20} />
              </div>
              <div className={styles.headerTitleGroup}>
                <div className={styles.headerTitle}>FixItNow AI Assistant</div>
                <div className={styles.headerSubtitle}>Ask about this {tradeLabel} issue</div>
              </div>
            </div>

            <div className={styles.onlineBadge}>
              <span className={styles.onlineBadgeDot} />
              <span>Online</span>
            </div>
          </div>

          {/* Messages Body */}
          <div className={styles.messagesArea}>
            {messages.map((m) => (
              <div
                key={m.id}
                className={`${styles.messageRow} ${m.sender === 'user' ? styles.messageRowUser : ''}`}
              >
                {m.sender === 'ai' && (
                  <div className={styles.aiAvatar}>
                    <SparklesIcon size={16} />
                  </div>
                )}
                <div className={m.sender === 'user' ? styles.bubbleUser : styles.bubbleAi}>
                  {renderFormattedMessage(m.text)}
                </div>
              </div>
            ))}

            {/* Quick Action Suggestion Chips - Rendered ONLY at start before user asks any question */}
            {!hasAskedAnyQuestion && (
              <div className={styles.chipsContainer}>
                {suggestionChips.map((chip) => (
                  <button
                    key={chip.id}
                    className={styles.chipBtn}
                    onClick={() => handleChipClick(chip.text)}
                    disabled={isThinking}
                  >
                    {chip.icon}
                    <span>{chip.text}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Thinking Indicator */}
            {isThinking && (
              <div className={styles.messageRow}>
                <div className={styles.aiAvatar}>
                  <SparklesIcon size={16} />
                </div>
                <div className={styles.typingIndicator}>
                  <div className={styles.typingDot} />
                  <div className={styles.typingDot} />
                  <div className={styles.typingDot} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input Bar */}
          <form
            className={styles.footer}
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
          >
            <input
              type="text"
              className={styles.inputField}
              placeholder={`Ask about this ${tradeLabel} issue...`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isThinking}
            />
            <button
              type="submit"
              className={styles.sendBtn}
              disabled={!inputText.trim() || isThinking}
              title="Send message"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>

          {/* Floating Circular Close Button ('X') at Bottom Right */}
          <button
            className={styles.closeFab}
            onClick={() => setIsOpen(false)}
            title="Close Assistant"
            aria-label="Close Assistant"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
