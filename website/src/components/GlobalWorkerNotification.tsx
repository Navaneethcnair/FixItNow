'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import BookingChatDrawer from '@/components/BookingChatDrawer';
import styles from './GlobalWorkerNotification.module.css';

function ZapIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function MapPinIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function CloseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function getCleanJobTitle(item: any): string {
  const rawTitle = item?.jobs?.ai_problem_title || item?.job_title || item?.ai_problem_title;
  if (rawTitle && typeof rawTitle === 'string' && !rawTitle.toLowerCase().includes('speaker system')) {
    return rawTitle;
  }
  if (item?.worker_trade) {
    return `New ${item.worker_trade.replace('_', ' ').toUpperCase()} Request`;
  }
  if (item?.workers?.trade) {
    return `New ${item.workers.trade.replace('_', ' ').toUpperCase()} Request`;
  }
  return 'New Service Repair Request';
}

export default function GlobalWorkerNotification() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [activeToast, setActiveToast] = useState<any>(null);
  const [activeMsgToast, setActiveMsgToast] = useState<any>(null);
  const [activeChatDrawer, setActiveChatDrawer] = useState<any>(null);
  const [toastKey, setToastKey] = useState<number>(0);
  const supabase = createClient();
  const router = useRouter();

  const [seenIds, setSeenIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('fixitnow_seen_bookings');
        if (stored) return new Set(JSON.parse(stored));
      } catch {}
    }
    return new Set();
  });

  const [seenMsgIds, setSeenMsgIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('fixitnow_seen_msgs');
        if (stored) return new Set(JSON.parse(stored));
      } catch {}
    }
    return new Set();
  });

  const [dismissedToastIds, setDismissedToastIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('fixitnow_dismissed_toasts');
        if (stored) return new Set(JSON.parse(stored));
      } catch {}
    }
    return new Set();
  });

  const dismissMsgToast = (toastMsgId?: string) => {
    if (toastMsgId) {
      setDismissedToastIds((prev) => {
        const updated = new Set(prev);
        updated.add(toastMsgId);
        if (typeof window !== 'undefined') {
          try { sessionStorage.setItem('fixitnow_dismissed_toasts', JSON.stringify(Array.from(updated))); } catch {}
        }
        return updated;
      });
    }
    setActiveMsgToast(null);
  };

  // High-Quality Web Audio Chime Alert
  const playAudioChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  }, []);

  // Check user session & role
  useEffect(() => {
    const checkRole = async () => {
      let role = 'customer';
      let uObj: any = null;

      if (typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem('fixitnow_user');
          if (raw) {
            uObj = JSON.parse(raw);
            if (uObj.user_metadata?.role) role = uObj.user_metadata.role;
            else if (uObj.role) role = uObj.role;
          }
        } catch {}
      }

      if (!uObj) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            uObj = user;
            const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
            if (p?.role) role = p.role;
          }
        } catch {}
      }

      setCurrentUser(uObj);
      setUserRole(role);
    };

    checkRole();
    window.addEventListener('storage', checkRole);
    window.addEventListener('fixitnow_auth_change', checkRole);

    return () => {
      window.removeEventListener('storage', checkRole);
      window.removeEventListener('fixitnow_auth_change', checkRole);
    };
  }, [supabase]);

  // Polling loop for pending booking requests (workers only)
  const pollWorkerBookings = useCallback(async () => {
    if (userRole !== 'worker') return;

    try {
      const res = await fetch('/api/bookings?role=worker');
      const data = await res.json();
      const list: any[] = data.bookings || [];

      const pending = list.filter(b => b.status === 'requested' || !b.status);
      setPendingRequests(pending);

      setSeenIds(prevSeen => {
        if (prevSeen.size > 0 && pending.length > 0) {
          const fresh = pending.find(b => !prevSeen.has(b.id) && !dismissedToastIds.has(b.id));
          if (fresh) {
            playAudioChime();
            setActiveToast(fresh);
          }
        }

        const updated = new Set(prevSeen);
        list.forEach(b => updated.add(b.id));
        if (typeof window !== 'undefined') {
          try { sessionStorage.setItem('fixitnow_seen_bookings', JSON.stringify(Array.from(updated))); } catch {}
        }
        return updated;
      });
    } catch {}
  }, [userRole, playAudioChime, dismissedToastIds]);

  // Universal Message Listener (Both Customer & Worker)
  const checkIncomingMessages = useCallback(async () => {
    if (!currentUser) return;

    const currentId = currentUser.id || 'local-user';

    try {
      const roleParam = userRole === 'worker' ? 'worker' : 'customer';
      const bRes = await fetch(`/api/bookings?role=${roleParam}`);
      const bData = await bRes.json();
      const bookingsList: any[] = bData.bookings || [];

      for (const b of bookingsList) {
        const mRes = await fetch(`/api/messages?bookingId=${b.id}`);
        const mData = await mRes.json();
        const msgs: any[] = mData.messages || [];

        const incomingMsgs = msgs.filter(m => m.sender_id !== currentId && m.sender_role !== userRole && m.sender_id !== 'system');

        if (incomingMsgs.length > 0) {
          const latest = incomingMsgs[incomingMsgs.length - 1];

          const isThisChatActive = typeof window !== 'undefined' && (
            (window as any).fixitnow_chat_open === true &&
            (window as any).fixitnow_active_chat_booking_id === b.id
          );

          setSeenMsgIds(prevSeen => {
            if (!prevSeen.has(latest.id) && !dismissedToastIds.has(latest.id)) {
              if (!isThisChatActive && prevSeen.size > 0) {
                playAudioChime();
                setToastKey(k => k + 1);

                const senderDisplayName = userRole === 'worker'
                  ? ((b.profiles?.full_name && b.profiles.full_name !== 'local-user') ? b.profiles.full_name : 'Customer / Homeowner')
                  : ((b.workers?.profiles?.full_name) ? b.workers.profiles.full_name : (b.worker_id ? 'Worker Specialist' : 'Assigned Worker'));

                const recipientAvatar = userRole === 'worker'
                  ? b.profiles?.avatar_url
                  : b.workers?.profiles?.avatar_url;

                const jobTitle = b.jobs?.ai_problem_title || 'Home Repair Job';

                setActiveMsgToast({
                  ...latest,
                  sender_display_name: senderDisplayName,
                  recipient_avatar: recipientAvatar,
                  job_title: jobTitle,
                  booking_id: b.id,
                });
              }
            }

            const updated = new Set(prevSeen);
            msgs.forEach(m => updated.add(m.id));
            if (typeof window !== 'undefined') {
              try { sessionStorage.setItem('fixitnow_seen_msgs', JSON.stringify(Array.from(updated))); } catch {}
            }
            return updated;
          });
        }
      }
    } catch {}
  }, [currentUser, userRole, playAudioChime, dismissedToastIds]);

  useEffect(() => {
    const handleChatState = (e: any) => {
      if (e?.detail?.isOpen) {
        setActiveMsgToast(null);
      }
    };
    const handleOpenChatGlobal = (e: any) => {
      const bId = e?.detail?.bookingId;
      if (bId) {
        setActiveChatDrawer({
          bookingId: bId,
          currentUserId: currentUser?.id || 'local-user',
          currentUserRole: userRole === 'worker' ? 'worker' : 'customer',
          recipientName: e?.detail?.recipientName || (userRole === 'worker' ? 'Customer' : 'Worker Specialist'),
          recipientAvatar: e?.detail?.recipientAvatar || null,
          jobTitle: e?.detail?.jobTitle || 'Active Service Booking',
        });
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('fixitnow_chat_state_change', handleChatState);
      window.addEventListener('fixitnow_open_chat', handleOpenChatGlobal);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('fixitnow_chat_state_change', handleChatState);
        window.removeEventListener('fixitnow_open_chat', handleOpenChatGlobal);
      }
    };
  }, [currentUser, userRole]);

  useEffect(() => {
    if (!currentUser) return;
    pollWorkerBookings();
    checkIncomingMessages();

    const interval = setInterval(() => {
      pollWorkerBookings();
      checkIncomingMessages();
    }, 4000);

    const handleBookingEvent = () => pollWorkerBookings();
    const handleMsgEvent = () => checkIncomingMessages();

    window.addEventListener('fixitnow_booking_change', handleBookingEvent);
    window.addEventListener('fixitnow_message_sent', handleMsgEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('fixitnow_booking_change', handleBookingEvent);
      window.removeEventListener('fixitnow_message_sent', handleMsgEvent);
    };
  }, [currentUser, pollWorkerBookings, checkIncomingMessages]);

  const handleAction = async (bookingId: string, status: string) => {
    setActiveToast(null);
    setPendingRequests(prev => prev.filter(b => b.id !== bookingId));

    try {
      await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, status }),
      });
      await supabase.from('bookings').update({ status }).eq('id', bookingId);
    } catch {}

    pollWorkerBookings();
  };

  const openChatFromToast = (toast: any) => {
    const bId = toast.booking_id || toast.bookingId;
    if (toast?.id) dismissMsgToast(toast.id);
    else setActiveMsgToast(null);

    if (bId) {
      setActiveChatDrawer({
        bookingId: bId,
        currentUserId: currentUser?.id || 'local-user',
        currentUserRole: userRole === 'worker' ? 'worker' : 'customer',
        recipientName: toast.sender_display_name || 'Service Specialist',
        recipientAvatar: toast.recipient_avatar,
        jobTitle: toast.job_title,
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fixitnow_open_chat', { detail: { bookingId: bId } }));
      }
    }
  };

  return (
    <>
      {activeChatDrawer && (
        <BookingChatDrawer
          bookingId={activeChatDrawer.bookingId}
          currentUserId={activeChatDrawer.currentUserId}
          currentUserRole={activeChatDrawer.currentUserRole}
          recipientName={activeChatDrawer.recipientName}
          recipientAvatar={activeChatDrawer.recipientAvatar}
          jobTitle={activeChatDrawer.jobTitle}
          isOpen={true}
          onClose={() => setActiveChatDrawer(null)}
        />
      )}

      {userRole === 'worker' && activeToast && (
        <div className={styles.toastCard}>
          <div className={styles.toastCardHeader}>
            <div className={styles.toastHeaderLeft}>
              <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }}>
                <ZapIcon size={20} />
              </div>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  NEW BOOKING REQUEST
                </span>
                <h4 style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                  {getCleanJobTitle(activeToast)}
                </h4>
              </div>
            </div>
            <button className={styles.closeBtn} onClick={() => setActiveToast(null)}>
              <CloseIcon size={14} />
            </button>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '12px 14px', fontSize: '13px' }}>
            <div style={{ fontWeight: 800, color: '#0f172a' }}>
              Customer: {activeToast.profiles?.full_name || 'Homeowner'}
            </div>
            {activeToast.jobs?.location_address && (
              <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MapPinIcon size={12} />
                <span>{activeToast.jobs.location_address}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              onClick={() => handleAction(activeToast.id, 'rejected')}
              style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', padding: '12px', borderRadius: '14px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}
            >
              Decline
            </button>
            <button
              onClick={() => handleAction(activeToast.id, 'accepted')}
              style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)', color: '#fff', border: 'none', padding: '12px', borderRadius: '14px', fontSize: '13px', fontWeight: 900, cursor: 'pointer', boxShadow: '0 6px 18px rgba(79, 70, 229, 0.35)' }}
            >
              Accept Job ✓
            </button>
          </div>
        </div>
      )}

      {activeMsgToast && (
        <div key={toastKey} className={styles.toastCard}>
          <div className={styles.toastCardHeader}>
            <div className={styles.toastHeaderLeft}>
              <div className={styles.toastAvatar}>
                {activeMsgToast.sender_display_name?.charAt(0)?.toUpperCase() || '💬'}
              </div>
              <div>
                <span className={styles.toastBadge}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  New Message Received
                </span>
                <span className={styles.toastSenderName}>
                  {activeMsgToast.sender_display_name}
                </span>
              </div>
            </div>

            <button className={styles.closeBtn} onClick={() => dismissMsgToast(activeMsgToast.id)}>
              <CloseIcon size={14} />
            </button>
          </div>

          <div className={styles.quoteBox}>
            &ldquo;{activeMsgToast.text}&rdquo;
          </div>

          <button className={styles.actionBtn} onClick={() => openChatFromToast(activeMsgToast)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>Open Chat & Reply →</span>
          </button>
        </div>
      )}
    </>
  );
}
