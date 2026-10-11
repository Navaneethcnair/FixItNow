'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './BookingChatDrawer.module.css';

interface BookingChatDrawerProps {
  bookingId: string;
  currentUserId: string;
  currentUserRole: 'customer' | 'worker';
  recipientName: string;
  recipientAvatar?: string | null;
  jobTitle?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function BookingChatDrawer({
  bookingId,
  currentUserId,
  currentUserRole,
  recipientName,
  recipientAvatar,
  jobTitle,
  isOpen,
  onClose,
}: BookingChatDrawerProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [pendingMedia, setPendingMedia] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    if (!bookingId) return;
    try {
      const res = await fetch(`/api/messages?bookingId=${bookingId}&role=${currentUserRole}`);
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.warn('Failed to fetch messages:', err);
    }
  }, [bookingId, currentUserRole]);

  useEffect(() => {
    if (isOpen) {
      if (typeof window !== 'undefined') {
        (window as any).fixitnow_chat_open = true;
        (window as any).fixitnow_active_chat_booking_id = bookingId;
        document.body.setAttribute('data-chat-open', 'true');
        window.dispatchEvent(new CustomEvent('fixitnow_chat_state_change', { detail: { isOpen: true, bookingId } }));
      }
    } else {
      if (typeof window !== 'undefined') {
        (window as any).fixitnow_chat_open = false;
        (window as any).fixitnow_active_chat_booking_id = null;
        document.body.removeAttribute('data-chat-open');
        window.dispatchEvent(new CustomEvent('fixitnow_chat_state_change', { detail: { isOpen: false } }));
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        (window as any).fixitnow_chat_open = false;
        (window as any).fixitnow_active_chat_booking_id = null;
        document.body.removeAttribute('data-chat-open');
        window.dispatchEvent(new CustomEvent('fixitnow_chat_state_change', { detail: { isOpen: false } }));
      }
    };
  }, [isOpen, bookingId]);

  useEffect(() => {
    if (isOpen) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 3000);

      const handleMsgEvent = () => fetchMessages();
      window.addEventListener('fixitnow_message_sent', handleMsgEvent);

      return () => {
        clearInterval(interval);
        window.removeEventListener('fixitnow_message_sent', handleMsgEvent);
      };
    }
  }, [isOpen, fetchMessages]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (messageText?: string) => {
    const content = messageText || text;
    const mediaToSend = pendingMedia;

    if (!content.trim() && !mediaToSend) return;

    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          senderId: currentUserId || 'local-user',
          senderName: currentUserRole === 'customer' ? 'Customer' : 'Worker',
          senderRole: currentUserRole,
          text: content.trim() ? content : 'Sent photo attachment',
          mediaUrl: mediaToSend || null,
        }),
      });

      if (res.ok) {
        if (!messageText) setText('');
        setPendingMedia(null);
        await fetchMessages();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('fixitnow_message_sent'));
        }
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setPendingMedia(base64);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (!isOpen) return null;

  const [bookingDetails, setBookingDetails] = useState<any>(null);

  useEffect(() => {
    if (!bookingId || !isOpen) return;
    const loadBooking = async () => {
      try {
        const res = await fetch(`/api/bookings?role=${currentUserRole}`);
        const data = await res.json();
        const list: any[] = data.bookings || [];
        let found = list.find((b: any) => String(b.id) === String(bookingId));

        if (!found) {
          const allRes = await fetch('/api/bookings');
          const allData = await allRes.json();
          const allList: any[] = allData.bookings || [];
          found = allList.find((b: any) => String(b.id) === String(bookingId));
        }

        if (found) {
          setBookingDetails(found);
        }
      } catch (err) {}
    };
    loadBooking();
  }, [bookingId, currentUserRole, isOpen]);

  // Compute actual recipient display name & job title
  let displayRecipientName = recipientName;

  const computeJobTitle = () => {
    if (bookingDetails?.jobs?.ai_problem_title) return bookingDetails.jobs.ai_problem_title;
    if (bookingDetails?.job_title) return bookingDetails.job_title;
    if (bookingDetails?.worker_trade) {
      const tradeName = bookingDetails.worker_trade.replace('_', ' ').toUpperCase();
      return `${tradeName} Service Request`;
    }
    if (bookingDetails?.workers?.trade) {
      const tradeName = bookingDetails.workers.trade.replace('_', ' ').toUpperCase();
      return `${tradeName} Service Request`;
    }
    if (bookingDetails?.notes && bookingDetails.notes.length > 3 && !bookingDetails.notes.includes('http')) {
      return bookingDetails.notes;
    }
    if (jobTitle && typeof jobTitle === 'string' && !jobTitle.toLowerCase().includes('speaker system') && jobTitle !== 'Chat Assistant') {
      return jobTitle;
    }
    return 'Active Repair Booking';
  };

  const resolvedJobTitle = computeJobTitle();

  if (bookingDetails) {
    if (currentUserRole === 'customer') {
      const workerName = bookingDetails.worker_name || bookingDetails.workers?.profiles?.full_name;
      if (workerName && workerName !== 'local-user') {
        displayRecipientName = workerName;
      }
    } else {
      const customerName = bookingDetails.profiles?.full_name;
      if (customerName && customerName !== 'local-user') {
        displayRecipientName = customerName;
      }
    }
  }

  if (!displayRecipientName || displayRecipientName === 'Chat Assistant' || displayRecipientName === 'Assigned Worker' || displayRecipientName === 'Customer') {
    if (messages.length > 0) {
      const otherMsg = messages.find(m => m.sender_id !== currentUserId && m.sender_role !== currentUserRole && m.sender_role !== 'system');
      if (otherMsg?.sender_name && otherMsg.sender_name !== 'Chat Assistant') {
        displayRecipientName = otherMsg.sender_name;
      }
    }
  }

  if (!displayRecipientName || displayRecipientName === 'Chat Assistant') {
    displayRecipientName = currentUserRole === 'customer' ? 'Service Specialist' : 'Customer / Homeowner';
  }

  const initials = displayRecipientName
    ? displayRecipientName.split(' ').filter(Boolean).map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const customerQuickReplies = [
    'What time will you arrive?',
    'I have shared my exact address pin.',
    'Please bring extra replacement parts.',
    'Is there anything I should turn off before visit?'
  ];

  const workerQuickReplies = [
    'On my way to your location now!',
    'Arrived outside. Please open the main door.',
    'Inspection complete. Repair work in progress.',
    'Job finished! Please inspect the repair work.'
  ];

  const quickReplies = currentUserRole === 'customer' ? customerQuickReplies : workerQuickReplies;

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const longPressTimerRef = useRef<any>(null);

  const handleTouchStart = (msgId: string) => {
    longPressTimerRef.current = setTimeout(() => {
      if (typeof window !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(50); } catch (e) {}
      }
      setIsSelectMode(true);
      setSelectedMessageIds((prev) => (prev.includes(msgId) ? prev : [...prev, msgId]));
    }, 350);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleDeleteSingle = async (msgId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    setSelectedMessageIds((prev) => prev.filter((id) => id !== msgId));
    setToastMsg('Message deleted');
    setTimeout(() => setToastMsg(null), 2200);

    try {
      await fetch(`/api/messages?bookingId=${bookingId}&messageId=${msgId}&role=${currentUserRole}`, {
        method: 'DELETE',
      });
    } catch (err) {}
  };

  const handleDeleteSelected = async () => {
    if (!selectedMessageIds.length || deleting) return;
    setDeleting(true);
    const idsToDelete = [...selectedMessageIds];
    setMessages((prev) => prev.filter((m) => !idsToDelete.includes(m.id)));
    setSelectedMessageIds([]);
    setIsSelectMode(false);
    setToastMsg(`${idsToDelete.length} message${idsToDelete.length > 1 ? 's' : ''} deleted`);
    setTimeout(() => setToastMsg(null), 2200);

    try {
      await fetch(`/api/messages?bookingId=${bookingId}&role=${currentUserRole}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageIds: idsToDelete, deleterRole: currentUserRole }),
      });
    } catch (err) {
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelectMessage = (msgId: string) => {
    setSelectedMessageIds((prev) =>
      prev.includes(msgId) ? prev.filter((id) => id !== msgId) : [...prev, msgId]
    );
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.userMeta}>
            <div className={styles.avatarWrap}>
              {recipientAvatar ? (
                <img src={recipientAvatar} alt={displayRecipientName} className={styles.avatar} />
              ) : (
                <div className={styles.avatarFallback}>{initials}</div>
              )}
              <span className={styles.onlineBadge} />
            </div>
            <div className={styles.userMetaText}>
              <div className={styles.nameRow}>
                <span className={styles.recipientName}>{displayRecipientName}</span>
                <span className={styles.roleTag}>
                  {currentUserRole === 'customer' ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: '4px' }}>
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                      </svg>
                      Assigned Worker
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: '4px' }}>
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      Customer
                    </>
                  )}
                </span>
              </div>
              <div className={styles.jobSub}>{resolvedJobTitle}</div>
            </div>
          </div>

          <div className={styles.headerRightActions}>
            <button
              type="button"
              className={styles.headerSelectBtn}
              onClick={() => {
                setIsSelectMode(!isSelectMode);
                if (isSelectMode) setSelectedMessageIds([]);
              }}
              title={isSelectMode ? 'Exit Selection Mode' : 'Select Messages'}
            >
              {isSelectMode ? 'Cancel' : 'Select'}
            </button>
            <button className={styles.closeBtn} onClick={onClose} title="Close Chat">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Selection Bar */}
        {isSelectMode && (
          <div className={styles.selectionBar}>
            <div className={styles.selectionCount}>
              <span>{selectedMessageIds.length} Selected</span>
            </div>
            <div className={styles.selectionActions}>
              <button
                type="button"
                className={styles.selectBtn}
                onClick={() => {
                  const userMsgs = messages.filter((m) => m.sender_role !== 'system').map((m) => m.id);
                  if (selectedMessageIds.length === userMsgs.length) {
                    setSelectedMessageIds([]);
                  } else {
                    setSelectedMessageIds(userMsgs);
                  }
                }}
              >
                {selectedMessageIds.length === messages.filter((m) => m.sender_role !== 'system').length ? 'Deselect All' : 'Select All'}
              </button>
              <button
                type="button"
                className={styles.deleteSelectedBtn}
                onClick={handleDeleteSelected}
                disabled={!selectedMessageIds.length || deleting}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                {deleting ? 'Deleting...' : `Delete (${selectedMessageIds.length})`}
              </button>
            </div>
          </div>
        )}

        {/* Floating Toast Bar */}
        {toastMsg && <div className={styles.toastBar}>✓ {toastMsg}</div>}

        {/* Message Stream */}
        <div className={styles.messagesContainer}>
          {messages.map((m) => {
            const isSelf = m.sender_role === currentUserRole || m.sender_id === currentUserId;
            const isSystem = m.sender_role === 'system';

            if (isSystem) {
              return (
                <div key={m.id} className={styles.systemBubble}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '6px', color: '#4f46e5' }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span>{m.text}</span>
                </div>
              );
            }

            const isSelected = selectedMessageIds.includes(m.id);

            return (
              <div
                key={m.id}
                className={`${styles.messageRow} ${isSelf ? styles.selfRow : styles.otherRow} ${isSelected ? styles.selectedRow : ''}`}
                onTouchStart={() => handleTouchStart(m.id)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchEnd}
                onMouseDown={() => handleTouchStart(m.id)}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setIsSelectMode(true);
                  setSelectedMessageIds((prev) => (prev.includes(m.id) ? prev : [...prev, m.id]));
                }}
                onClick={(e) => {
                  if (isSelectMode) {
                    e.stopPropagation();
                    toggleSelectMessage(m.id);
                  }
                }}
                style={{ cursor: isSelectMode ? 'pointer' : 'default' }}
              >
                {/* Checkbox for Select Mode */}
                {isSelectMode && (
                  <div
                    className={`${styles.selectCheckbox} ${isSelected ? styles.selectCheckboxActive : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectMessage(m.id);
                    }}
                  >
                    {isSelected && '✓'}
                  </div>
                )}

                {!isSelf && (
                  <div className={styles.msgAvatar}>
                    {recipientAvatar ? (
                      <img src={recipientAvatar} alt={displayRecipientName} />
                    ) : (
                      initials
                    )}
                  </div>
                )}
                <div className={`${styles.bubble} ${isSelf ? styles.selfBubble : styles.otherBubble}`}>
                  {m.media_url && (
                    <div
                      className={styles.msgMediaWrap}
                      onClick={(e) => {
                        if (!isSelectMode) {
                          e.stopPropagation();
                          setSelectedPhoto(m.media_url);
                        }
                      }}
                      title="Click to view photo full screen"
                    >
                      <img src={m.media_url} alt="Attachment" className={styles.msgMediaImg} />
                      <div className={styles.msgMediaHint}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                          <line x1="11" y1="8" x2="11" y2="14" />
                          <line x1="8" y1="11" x2="14" y2="11" />
                        </svg>
                        <span>Click to View</span>
                      </div>
                    </div>
                  )}
                  <div className={styles.msgText}>{m.text}</div>
                  <div className={styles.msgTime}>
                    {new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Presets */}
        <div className={styles.presetsWrap}>
          <span className={styles.presetsLabel}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: '4px', color: '#4f46e5' }}>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Quick Reply Presets:
          </span>
          <div className={styles.presetsList}>
            {quickReplies.map((reply, i) => (
              <button
                key={i}
                className={styles.presetChip}
                onClick={() => handleSend(reply)}
                disabled={sending}
              >
                {reply}
              </button>
            ))}
          </div>
        </div>

        {/* Pending Attachment Preview Card */}
        {pendingMedia && (
          <div className={styles.attachmentPreviewBar}>
            <div className={styles.previewThumbWrap}>
              <img src={pendingMedia} alt="Attached Preview" className={styles.previewThumbImg} />
              <button
                type="button"
                className={styles.removePreviewBtn}
                onClick={() => setPendingMedia(null)}
                title="Remove Photo"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className={styles.previewInfoText}>
              <span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '6px', color: '#4f46e5' }}>
                  <rect x="3" y="3" width="18" height="18" rx="4" ry="4" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                Photo Attached
              </span>
              <p>Type a message below or press Send to submit photo & text together.</p>
            </div>
          </div>
        )}

        {/* Input Bar */}
        <form
          className={styles.inputBar}
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <label className={`${styles.attachBtn} ${pendingMedia ? styles.attachActive : ''}`} title="Attach Photo">
            <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="4" ry="4" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </label>
          <input
            type="text"
            className={styles.inputField}
            placeholder={pendingMedia ? 'Add a caption to this photo...' : `Type a message to ${displayRecipientName}...`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={sending}
          />
          <button
            type="submit"
            className={styles.sendBtn}
            disabled={(!text.trim() && !pendingMedia) || sending}
          >
            {sending ? (
              'Sending...'
            ) : (
              <>
                <span>Send</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '4px', display: 'inline-block', verticalAlign: '-1px' }}>
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </>
            )}
          </button>
        </form>
      </div>

      {/* ── Photo Lightbox Modal Overlay ── */}
      {selectedPhoto && (
        <div
          className={styles.lightboxOverlay}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedPhoto(null);
          }}
        >
          <div className={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
            <button
              className={styles.lightboxClose}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPhoto(null);
              }}
              title="Close photo view"
            >
              ✕
            </button>
            <img src={selectedPhoto} alt="Full Size Inspection Photo" className={styles.lightboxImg} />
            <div className={styles.lightboxCap}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '6px', color: '#818cf8' }}>
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span>Full HD Inspection Photo — Click outside to close photo</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
