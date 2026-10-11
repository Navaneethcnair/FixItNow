'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TRADE_CONFIG, TradeType } from '@/lib/types';
import {
  StarIcon,
  CalendarIcon,
  ClockIcon,
  CheckBadgeIcon,
  getTradeIcon,
  MapPinIcon,
  WrenchIcon,
  AwardIcon,
} from '@/components/Icons';
import DraggableCard from '@/components/DraggableCard';
import BookingChatDrawer from '@/components/BookingChatDrawer';
import styles from './worker-dash.module.css';

// ── Weekly earnings chart (last 7 days) ──────────────────────────────────────
function EarningsChart({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return (
    <div className={styles.chartWrap}>
      {data.map((val, i) => (
        <div key={i} className={styles.chartBarCol}>
          <span className={styles.chartBarAmount}>
            {val > 0 ? `₹${val.toLocaleString('en-IN')}` : ''}
          </span>
          <div className={styles.chartBarTrack}>
            <div
              className={styles.chartBarFill}
              style={{ height: `${val > 0 ? Math.max((val / max) * 100, 8) : 0}%` }}
            />
          </div>
          <span className={styles.chartBarDay}>{days[i]}</span>
        </div>
      ))}
    </div>
  );
}

// ── Star rating row ───────────────────────────────────────────────────────────
function Stars({ rating }: { rating: number }) {
  return (
    <div className={styles.starsRow}>
      {Array.from({ length: 5 }, (_, i) => (
        <StarIcon
          key={i}
          size={14}
          style={{ color: i < Math.round(rating) ? '#fbbf24' : '#cbd5e1', opacity: 1 }}
        />
      ))}
    </div>
  );
}

// ── Circular progress ring ────────────────────────────────────────────────────
function RingProgress({ pct, color, label }: { pct: number; color: string; label: string }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className={styles.ringWrap}>
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#e2e8f0" strokeWidth="5" />
        <circle
          cx="36" cy="36" r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x="36" y="41" textAnchor="middle" fontSize="13" fontWeight="800" fill="#0f172a">{pct}%</text>
      </svg>
      <span className={styles.ringLabel}>{label}</span>
    </div>
  );
}

function WorkerDashboardContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [bookings, setBookings] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [worker, setWorker] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'requests' | 'active' | 'history'>(
    tabParam === 'active' ? 'active' : tabParam === 'history' ? 'history' : 'requests'
  );
  const [copyMsg, setCopyMsg] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [openMaps, setOpenMaps] = useState<Record<string, boolean>>({});

  const DEFAULT_STAT_CARDS = ['pending', 'active', 'completed', 'rating', 'earnings', 'reviews'];
  const [statCardOrder, setStatCardOrder] = useState<string[]>(DEFAULT_STAT_CARDS);

  const DEFAULT_MAIN_SECTIONS = ['analytics-row', 'jobs-control', 'schedule-row', 'reviews-section'];
  const [mainSectionOrder, setMainSectionOrder] = useState<string[]>(DEFAULT_MAIN_SECTIONS);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedStats = localStorage.getItem('fixitnow_worker_stat_order');
        if (savedStats) {
          const parsed = JSON.parse(savedStats);
          if (Array.isArray(parsed) && parsed.length === DEFAULT_STAT_CARDS.length) {
            setStatCardOrder(parsed);
          }
        }
        const savedSections = localStorage.getItem('fixitnow_worker_section_order');
        if (savedSections) {
          const parsed = JSON.parse(savedSections);
          if (Array.isArray(parsed) && parsed.length === DEFAULT_MAIN_SECTIONS.length) {
            setMainSectionOrder(parsed);
          }
        }
      } catch {}
    }
  }, []);

  const moveStatCard = (fromIndex: number, toIndex: number) => {
    setStatCardOrder((prev) => {
      const updated = [...prev];
      const [movedItem] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, movedItem);
      if (typeof window !== 'undefined') {
        localStorage.setItem('fixitnow_worker_stat_order', JSON.stringify(updated));
      }
      return updated;
    });
  };

  const moveMainSection = (fromIndex: number, toIndex: number) => {
    setMainSectionOrder((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      if (typeof window !== 'undefined') {
        localStorage.setItem('fixitnow_worker_section_order', JSON.stringify(updated));
      }
      return updated;
    });
  };

  const scrollToSection = useCallback((id: string) => {
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        const y = el.getBoundingClientRect().top + window.pageYOffset - 95;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }
    }, 50);
  }, []);

  const openChatParam = searchParams.get('openChat');
  const openChatHandledRef = useRef<string | null>(null);

  useEffect(() => {
    if (tabParam === 'active' || tabParam === 'history' || tabParam === 'requests') {
      setActiveTab(tabParam);
      scrollToSection('jobs-control');
    }
  }, [tabParam, scrollToSection]);

  useEffect(() => {
    if (openChatParam && bookings.length > 0 && openChatHandledRef.current !== openChatParam) {
      openChatHandledRef.current = openChatParam;
      const target = bookings.find((b) => b.id === openChatParam);
      if (target) {
        setActiveChatBooking(target);
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', '/worker-dashboard?tab=active');
        }
      }
    }
  }, [openChatParam, bookings]);



  // Check if current logged-in worker is the demo account mfazil313@gmail.com / mfazil313 / w1
  const isDemoWorkerAccount =
    profile?.email === 'mfazil313@gmail.com' ||
    profile?.id === 'mfazil313' ||
    profile?.id === 'w1' ||
    worker?.id === 'w1' ||
    worker?.id === 'mfazil313';

  // Compute weekly earnings (Mon-Sun) dynamically from real completed bookings
  const computeWeeklyEarnings = () => {
    if (isDemoWorkerAccount) return [1200, 0, 2500, 800, 3200, 1800, 0];

    const dayEarnings = [0, 0, 0, 0, 0, 0, 0]; // Mon (0) to Sun (6)
    const completedList = bookings.filter((b) => b.status === 'completed');
    const now = new Date();
    const currentDay = now.getDay();
    const startOfWeek = new Date(now);
    const distanceToMon = currentDay === 0 ? 6 : currentDay - 1;
    startOfWeek.setDate(now.getDate() - distanceToMon);
    startOfWeek.setHours(0, 0, 0, 0);

    completedList.forEach((b) => {
      const bDate = new Date(b.created_at || b.scheduled_at || Date.now());
      if (bDate >= startOfWeek) {
        const d = bDate.getDay();
        const index = d === 0 ? 6 : d - 1;
        const price = Number(b.price_quoted || b.price || 0);
        dayEarnings[index] += price;
      }
    });

    return dayEarnings;
  };

  const weeklyEarnings = computeWeeklyEarnings();
  const totalWeekEarnings = weeklyEarnings.reduce((a, b) => a + b, 0);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const maxEarning = Math.max(...weeklyEarnings, 0);
  const maxDayIndex = weeklyEarnings.indexOf(maxEarning);

  const peakDayLabel = isDemoWorkerAccount
    ? 'Peak day: ₹3,200 (Friday)'
    : (maxEarning > 0 ? `Peak day: ₹${maxEarning.toLocaleString('en-IN')} (${daysOfWeek[maxDayIndex]})` : 'Peak day: ₹0');

  const growthLabel = isDemoWorkerAccount
    ? '+18% growth this week'
    : (totalWeekEarnings > 0 ? 'Real-Time Earnings' : '0% growth this week');

  // Dynamic performance metrics
  const completedList = bookings.filter((b) => b.status === 'completed');
  const acceptedList = bookings.filter((b) => b.status === 'accepted');

  const performanceMetrics = isDemoWorkerAccount
    ? {
        completionRate: 96,
        acceptanceRate: 88,
        onTimeRate: 92,
        avgResponseMin: 10,
        avgResponseText: '10 mins',
      }
    : {
        completionRate: bookings.length > 0 ? (completedList.length > 0 ? Math.round((completedList.length / ((acceptedList.length + completedList.length) || 1)) * 100) : 0) : 0,
        acceptanceRate: bookings.length > 0 ? Math.round(((acceptedList.length + completedList.length) / bookings.length) * 100) : 0,
        onTimeRate: completedList.length > 0 ? 100 : 0,
        avgResponseMin: bookings.length > 0 ? 5 : 0,
        avgResponseText: bookings.length > 0 ? '< 5 mins' : 'No requests received yet',
      };

  const [newBookingAlert, setNewBookingAlert] = useState<any>(null);
  const [knownBookingIds, setKnownBookingIds] = useState<Set<string>>(new Set());
  const [activeChatBooking, setActiveChatBooking] = useState<any>(null);

  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  };

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login?redirect=/worker-dashboard');
        return;
      }

      const [profileRes, workerRes, bookingsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('workers').select('*').eq('id', user.id).single(),
        fetch('/api/bookings?role=worker').then(r => r.json()).catch(() => ({ bookings: [] }))
      ]);

      const p = profileRes.data;
      if (p?.role === 'customer') {
        router.replace('/dashboard');
        return;
      }

      const userEmail = user.email || user.user_metadata?.email || p?.email || '';
      const isDemo =
        userEmail === 'mfazil313@gmail.com' ||
        user.id === 'mfazil313' ||
        user.id === 'w1' ||
        p?.email === 'mfazil313@gmail.com';

      setProfile(p || { id: user.id, email: userEmail, full_name: user.user_metadata?.full_name || 'Worker', role: 'worker' });
      setWorker(workerRes.data || {
        id: user.id,
        trade: user.user_metadata?.trade || 'other',
        rating: isDemo ? 4.8 : 0,
        total_reviews: isDemo ? 12 : 0,
        is_available: true
      });

      const fetchedList: any[] = bookingsRes.bookings || [];
      setBookings(fetchedList);

      // Detect incoming requested bookings for chime and notification banner
      setKnownBookingIds((prevKnown) => {
        if (prevKnown.size > 0) {
          const freshRequest = fetchedList.find(b => (b.status === 'requested' || !b.status) && !prevKnown.has(b.id));
          if (freshRequest) {
            playChime();
            setNewBookingAlert(freshRequest);
          }
        }
        const updated = new Set(prevKnown);
        fetchedList.forEach(b => updated.add(b.id));
        return updated;
      });

      // Fetch reviews dynamically from /api/reviews
      try {
        const rRes = await fetch(`/api/reviews?workerId=${user.id}`);
        const rData = await rRes.json();
        if (rRes.ok && Array.isArray(rData.reviews) && rData.reviews.length > 0) {
          setReviews(rData.reviews.map((r: any) => ({
            id: r.id,
            rating: Number(r.rating) || 5,
            comment: r.comment || 'Great service!',
            date: r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently',
            customer_name: r.profiles?.full_name || 'Verified Customer'
          })));
        } else if (isDemo) {
          setReviews([
            { id: '1', rating: 5, comment: 'Very professional and fast service. Highly recommended!', date: '2 days ago', customer_name: 'Priya Mehta' },
            { id: '2', rating: 4, comment: 'Did a great job fixing the plumbing leak in the kitchen. Clean and efficient work.', date: '4 days ago', customer_name: 'Arjun Singh' },
            { id: '3', rating: 5, comment: 'Arrived right on time, explained the issue clearly, and solved it in under 30 minutes!', date: '1 week ago', customer_name: 'Neha Kapoor' },
          ]);
        } else {
          setReviews([]);
        }
      } catch {
        if (isDemo) {
          setReviews([
            { id: '1', rating: 5, comment: 'Very professional and fast service. Highly recommended!', date: '2 days ago', customer_name: 'Priya Mehta' },
            { id: '2', rating: 4, comment: 'Did a great job fixing the plumbing leak in the kitchen. Clean and efficient work.', date: '4 days ago', customer_name: 'Arjun Singh' },
            { id: '3', rating: 5, comment: 'Arrived right on time, explained the issue clearly, and solved it in under 30 minutes!', date: '1 week ago', customer_name: 'Neha Kapoor' },
          ]);
        } else {
          setReviews([]);
        }
      }
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);

    const handleBookingEvent = () => fetchData();
    window.addEventListener('fixitnow_booking_change', handleBookingEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('fixitnow_booking_change', handleBookingEvent);
    };
  }, [fetchData]);

  useEffect(() => {
    const handleOpenChatEvent = (e: any) => {
      const bId = e?.detail?.bookingId;
      if (bId) {
        openChatHandledRef.current = bId;
        const target = bookings.find((b) => b.id === bId);
        if (target) {
          setActiveChatBooking(target);
          setActiveTab('active');
        } else {
          fetchData();
        }
      }
    };

    window.addEventListener('fixitnow_open_chat', handleOpenChatEvent);
    return () => window.removeEventListener('fixitnow_open_chat', handleOpenChatEvent);
  }, [bookings, fetchData]);

  const handleBookingAction = async (bookingId: string, status: string) => {
    setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status } : b)));
    if (newBookingAlert?.id === bookingId) {
      setNewBookingAlert(null);
    }

    try {
      await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, status }),
      });
      await supabase.from('bookings').update({ status }).eq('id', bookingId);
      if (status === 'accepted') {
        const booking = bookings.find((b) => b.id === bookingId);
        if (booking?.job_id) {
          await supabase.from('jobs').update({ status: 'in_progress' }).eq('id', booking.job_id);
        }
      }
    } catch {}
    fetchData();
  };

  const toggleAvailability = () => {
    if (!worker) return;
    const newStatus = !worker.is_available;
    // 1. Optimistic 0ms instant UI update
    setWorker((prev: any) => (prev ? { ...prev, is_available: newStatus } : null));

    // 2. Async database update in background
    supabase
      .from('workers')
      .update({ is_available: newStatus })
      .eq('id', worker.id)
      .then(({ error }: any) => {
        if (error) {
          // Revert state if backend update fails
          setWorker((prev: any) => (prev ? { ...prev, is_available: !newStatus } : null));
        }
      });
  };

  const copyProfileLink = () => {
    const url = `${window.location.origin}/worker/${worker?.id || 'w1'}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyMsg('✓ Link Copied!');
      setTimeout(() => setCopyMsg(''), 2500);
    });
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.loadingState}>
            <div className="spinner spinner-lg" />
            <p>Loading worker console...</p>
          </div>
        </div>
      </div>
    );
  }

  const trade = worker ? TRADE_CONFIG[worker.trade as TradeType] || TRADE_CONFIG.other : TRADE_CONFIG.other;
  const pendingBookings = bookings.filter((b) => b.status === 'requested');
  const acceptedBookings = bookings.filter((b) => b.status === 'accepted');
  const completedBookings = bookings.filter((b) => b.status === 'completed');
  const initials = profile?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || '?';

  const totalReviews = reviews.length > 0 ? reviews.length : (typeof worker?.total_reviews === 'number' && isDemoWorkerAccount ? worker.total_reviews : (isDemoWorkerAccount ? 12 : 0));
  const hasReviews = totalReviews > 0;
  const avgRating = hasReviews
    ? (reviews.length > 0 ? (reviews.reduce((acc: number, r: any) => acc + (Number(r.rating) || 5), 0) / reviews.length) : (Number(worker?.rating) || (isDemoWorkerAccount ? 4.8 : 0)))
    : 0;

  const renderStatCard = (cardId: string) => {
    switch (cardId) {
      case 'pending':
        return (
          <div
            className={styles.statCard}
            onClick={() => {
              setActiveTab('requests');
              scrollToSection('jobs-control');
            }}
            title="Click to view incoming requests"
          >
            <div className={styles.statTopRow} style={{ paddingRight: '28px' }}>
              <div className={styles.statIcon} style={{ background: '#fef3c7', color: '#d97706' }}>
                <ClockIcon size={22} />
              </div>
              <span className={styles.trendTag} style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>Needs action</span>
            </div>
            <div>
              <div className={styles.statNum}>{pendingBookings.length}</div>
              <div className={styles.statLbl}>Pending Requests</div>
            </div>
          </div>
        );

      case 'active':
        return (
          <div
            className={styles.statCard}
            onClick={() => {
              setActiveTab('active');
              scrollToSection('jobs-control');
            }}
            title="Click to view active jobs"
          >
            <div className={styles.statTopRow} style={{ paddingRight: '28px' }}>
              <div className={styles.statIcon} style={{ background: '#e0f2fe', color: '#0284c7' }}>
                <WrenchIcon size={22} />
              </div>
              <span className={styles.trendTag} style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}>In progress</span>
            </div>
            <div>
              <div className={styles.statNum}>{acceptedBookings.length}</div>
              <div className={styles.statLbl}>Active Jobs</div>
            </div>
          </div>
        );

      case 'completed':
        return (
          <div
            className={styles.statCard}
            onClick={() => {
              setActiveTab('history');
              scrollToSection('jobs-control');
            }}
            title="Click to view completed job history"
          >
            <div className={styles.statTopRow} style={{ paddingRight: '28px' }}>
              <div className={styles.statIcon} style={{ background: '#dcfce7', color: '#16a34a' }}>
                <CheckBadgeIcon size={22} />
              </div>
              <span className={styles.trendTag} style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>100% fulfilled</span>
            </div>
            <div>
              <div className={styles.statNum}>{completedBookings.length || (isDemoWorkerAccount ? 12 : 0)}</div>
              <div className={styles.statLbl}>Completed</div>
            </div>
          </div>
        );

      case 'rating':
        return (
          <div
            className={styles.statCard}
            onClick={() => {
              scrollToSection('reviews-section');
            }}
            title="Click to jump to customer reviews"
          >
            <div className={styles.statTopRow} style={{ paddingRight: '28px' }}>
              <div className={styles.statIcon} style={{ background: '#fef3c7', color: '#d97706' }}>
                <StarIcon size={22} />
              </div>
              <span className={styles.trendTag} style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>{hasReviews ? 'Top 5% in city' : 'New Specialist'}</span>
            </div>
            <div>
              <div className={styles.statNum}>{hasReviews ? avgRating.toFixed(1) : 'New'}</div>
              <div className={styles.statLbl}>Avg Rating</div>
            </div>
          </div>
        );

      case 'earnings':
        return (
          <div
            className={styles.statCard}
            onClick={() => {
              scrollToSection('earnings-section');
            }}
            title="Click to jump to weekly revenue chart"
          >
            <div className={styles.statTopRow} style={{ paddingRight: '28px' }}>
              <div className={styles.statIcon} style={{ background: '#e0e7ff', color: '#4f46e5' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <span className={styles.trendTag} style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>{growthLabel}</span>
            </div>
            <div>
              <div className={styles.statNum}>₹{totalWeekEarnings.toLocaleString('en-IN')}</div>
              <div className={styles.statLbl}>This Week</div>
            </div>
          </div>
        );

      case 'reviews':
      default:
        return (
          <div
            className={styles.statCard}
            onClick={() => {
              scrollToSection('reviews-section');
            }}
            title="Click to jump to customer feedback"
          >
            <div className={styles.statTopRow} style={{ paddingRight: '28px' }}>
              <div className={styles.statIcon} style={{ background: '#fce7f3', color: '#db2777' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </div>
              <span className={styles.trendTag} style={{ background: '#fdf2f8', color: '#be185d', border: '1px solid #fbcfe8' }}>Verified feedback</span>
            </div>
            <div>
              <div className={styles.statNum}>{totalReviews || (isDemoWorkerAccount ? 12 : 0)}</div>
              <div className={styles.statLbl}>Total Reviews</div>
            </div>
          </div>
        );
    }
  };

  const renderMainSection = (sectionId: string) => {
    switch (sectionId) {
      case 'jobs-control':
        return (
          <div className={styles.card} id="jobs-control">
            <div className={styles.tabsContainer}>
              <div className={styles.segmentedTabNav} style={{ paddingRight: '40px' }}>
                {(['requests', 'active', 'history'] as const).map((tab) => (
                  <button
                    key={tab}
                    className={`${styles.segmentedTab} ${activeTab === tab ? styles.segmentedTabActive : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab === 'requests' && (
                      <>Incoming Requests {pendingBookings.length > 0 && <span className={styles.tabCountBadge}>{pendingBookings.length}</span>}</>
                    )}
                    {tab === 'active' && (
                      <>Active Jobs {acceptedBookings.length > 0 && <span className={styles.tabCountBadge}>{acceptedBookings.length}</span>}</>
                    )}
                    {tab === 'history' && 'Completed History'}
                  </button>
                ))}
              </div>

              {/* Requests Tab */}
              {activeTab === 'requests' && (
                <div className={styles.tabContent}>
                  {pendingBookings.length > 0 ? (
                    <div className={styles.requestsGrid}>
                      {pendingBookings.map((b) => {
                        const customerInitials = b.profiles?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || '?';
                        return (
                          <div key={b.id} className={styles.requestCard}>
                            <div className={styles.requestTop}>
                              <div className={styles.customerMeta}>
                                <div className={styles.customerAvatar}>{customerInitials}</div>
                                <div>
                                  <div className={styles.requestCustomer}>{b.profiles?.full_name || 'Customer'}</div>
                                  <div className={styles.requestJob}>{b.jobs?.ai_problem_title || 'Service Request'}</div>
                                </div>
                              </div>
                              {b.scheduled_at && (
                                <div className={styles.requestTimeBadge}>
                                  <CalendarIcon size={12} />
                                  {new Date(b.scheduled_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                            </div>

                            {/* Scanned Photo & AI Instructions Box */}
                            <div className={styles.requestAiRow}>
                              {b.jobs?.media_url ? (
                                <img
                                  src={b.jobs.media_url}
                                  alt="Scanned problem"
                                  className={styles.requestPhotoThumb}
                                  onClick={() => setSelectedPhoto(b.jobs.media_url)}
                                />
                              ) : (
                                <div style={{ width: '76px', height: '76px', background: '#eef2ff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#4f46e5', fontWeight: 700, textAlign: 'center', padding: '4px' }}>
                                  📷 Direct Booking
                                </div>
                              )}
                              <div className={styles.requestAiDetails}>
                                <p className={styles.requestDesc}>
                                  {b.jobs?.ai_description || 'Scanned damage detected on water pipe main line.'}
                                </p>
                                <div className={styles.requestToolsBox}>
                                  <strong>🧰 Tools to Bring:</strong>{' '}
                                  {b.jobs?.worker_instructions || 'PVC pipe repair kit, pipe cutter, sealant, Teflon tape, safety gloves.'}
                                </div>
                              </div>
                            </div>

                            <div className={styles.requestMeta}>
                              {b.jobs?.ai_severity && (
                                <span className={`badge badge-${b.jobs.ai_severity}`}>
                                  {b.jobs.ai_severity} priority
                                </span>
                              )}
                              {b.price_quoted && (
                                <span className={styles.pricePill}>₹{b.price_quoted}</span>
                              )}
                              {b.jobs?.location_address && (
                                <span className={styles.locationSmall}>
                                  <MapPinIcon size={12} /> {b.jobs.location_address.split(',')[0]}
                                </span>
                              )}
                            </div>

                            <div className={styles.requestActions}>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleBookingAction(b.id, 'accepted')}
                                style={{ flex: 2 }}
                              >
                                ✓ Accept Job
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleBookingAction(b.id, 'rejected')}
                                style={{ flex: 1, color: 'var(--danger)' }}
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIconBadge}>
                        <ClockIcon size={28} />
                      </div>
                      <h3>No Pending Requests</h3>
                      <p>New repair requests from nearby customers will appear here in real-time. Make sure your availability is set to Online.</p>
                      {!worker?.is_available && (
                        <button className="btn btn-primary btn-sm" onClick={toggleAvailability}>
                          ⚡ Toggle Online Availability Now
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Active Jobs Tab */}
              {activeTab === 'active' && (
                <div className={styles.tabContent}>
                  {acceptedBookings.length > 0 ? (
                    <div className={styles.list}>
                      {acceptedBookings.map((b) => {
                        const customerName = b.profiles?.full_name || 'Customer';
                        const initials = customerName.split(' ').map((n: string) => n[0]).join('').toUpperCase() || '?';
                        const phone = b.profiles?.phone || '+91 98765 43210';
                        const rawAddr = [b.address, b.pincode].filter(Boolean).join(', ') || b.notes || b.jobs?.location_address || '';
                        const cleanAddress = (rawAddr && !rawAddr.startsWith('m,') && rawAddr !== 'm' && rawAddr !== 'm, ,')
                          ? rawAddr
                          : 'Flat 402, Sunshine Heights, Bandra West, Mumbai 400050';
                        const cleanCity = cleanAddress.split(',')[0].trim() || 'Bandra West';
                        const jobTitle = b.jobs?.ai_problem_title || 'Direct Repair Booking';
                        const dateStr = b.scheduled_at
                          ? new Date(b.scheduled_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                          : 'Scheduled Visit';

                        return (
                          <div key={b.id} className={styles.activeCard}>
                            {/* Top Header Row */}
                            <div className={styles.activeCardHeader}>
                              <div className={styles.activeCustomerBlock}>
                                <div className={styles.activeAvatar}>{initials}</div>
                                <div>
                                  <div className={styles.activeCustomerRow}>
                                    <span className={styles.activeCustomerName}>{customerName}</span>
                                    <span className={styles.activeStatusBadge}>
                                      <span className={styles.activePulseDot} /> Active Job
                                    </span>
                                  </div>
                                  <div className={styles.activeJobTitle}>{jobTitle}</div>
                                </div>
                              </div>

                              <div className={styles.activeTimeBadge}>
                                <CalendarIcon size={14} />
                                <span>{dateStr}</span>
                              </div>
                            </div>

                            {/* Check if booked via AI Scanned Media vs Direct Hire */}
                            {b.jobs?.media_url ? (
                              /* AI PROBLEM ANALYSIS & PHOTO Card (Only shown if media_url photo/video exists) */
                              <div className={styles.activeAiDiagnosticCard}>
                                <div className={styles.activeAiTitleRow}>
                                  <div className={styles.activeAiTitle}>
                                    <div className={styles.activeAiRobotIcon}>
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83" />
                                      </svg>
                                    </div>
                                    <div>
                                      <span className={styles.activeAiTag}>AI PROBLEM ANALYSIS & PHOTO</span>
                                      <div className={styles.activeAiProblemName}>{b.jobs?.ai_problem_title || 'Pipe Repair & Damage Inspection'}</div>
                                    </div>
                                  </div>
                                  {b.jobs?.ai_severity && (
                                    <span className={`badge badge-${b.jobs.ai_severity}`}>
                                      {b.jobs.ai_severity.toUpperCase()}
                                    </span>
                                  )}
                                </div>

                                <div className={styles.activeAiContentGroup}>
                                  <div
                                    className={styles.activePhotoContainer}
                                    onClick={() => setSelectedPhoto(b.jobs.media_url)}
                                  >
                                    {b.jobs.media_type === 'video' ? (
                                      <video src={b.jobs.media_url} className={styles.activePhotoImg} />
                                    ) : (
                                      <img
                                        src={b.jobs.media_url}
                                        alt="Customer Uploaded Scanned Damage"
                                        className={styles.activePhotoImg}
                                      />
                                    )}
                                    <span className={styles.activePhotoTag}>
                                      {b.jobs.media_type === 'video' ? '🎥 Click to Play Video' : '📸 Click to Zoom Photo'}
                                    </span>
                                  </div>

                                  <div className={styles.activeAiTextDetails}>
                                    <p className={styles.activeAiDescription}>
                                      {b.jobs?.ai_description || 'Scanned repair job request with AI visual diagnostics.'}
                                    </p>

                                    {b.jobs?.ai_dimension && (
                                      <div className={styles.activeAiDimensionBadge}>
                                        <strong>Approx Size:</strong> {b.jobs.ai_dimension}
                                      </div>
                                    )}

                                    {/* Specialized AI Domain Calculations */}
                                    {b.jobs?.specialized_metrics && (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                                        {b.jobs.specialized_metrics.land_size_sqft && (
                                          <span style={{ fontSize: '11px', fontWeight: 700, background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: '6px' }}>
                                            🚜 Land: {b.jobs.specialized_metrics.land_size_sqft}
                                          </span>
                                        )}
                                        {b.jobs.specialized_metrics.fuel_required_liters && (
                                          <span style={{ fontSize: '11px', fontWeight: 700, background: '#fef3c7', color: '#92400e', padding: '3px 8px', borderRadius: '6px' }}>
                                            ⛽ Fuel: {b.jobs.specialized_metrics.fuel_required_liters}
                                          </span>
                                        )}
                                        {b.jobs.specialized_metrics.tank_capacity_liters && (
                                          <span style={{ fontSize: '11px', fontWeight: 700, background: '#e0f2fe', color: '#075985', padding: '3px 8px', borderRadius: '6px' }}>
                                            💧 Tank: {b.jobs.specialized_metrics.tank_capacity_liters}
                                          </span>
                                        )}
                                        {b.jobs.specialized_metrics.brick_count_estimate && (
                                          <span style={{ fontSize: '11px', fontWeight: 700, background: '#ffedd5', color: '#9a3412', padding: '3px 8px', borderRadius: '6px' }}>
                                            🧱 Bricks: {b.jobs.specialized_metrics.brick_count_estimate}
                                          </span>
                                        )}
                                        {b.jobs.specialized_metrics.pressure_washer_psi && (
                                          <span style={{ fontSize: '11px', fontWeight: 700, background: '#ccfbf1', color: '#115e59', padding: '3px 8px', borderRadius: '6px' }}>
                                            🧼 Pressure: {b.jobs.specialized_metrics.pressure_washer_psi}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Required Tools & Material Checklist for Worker */}
                                <div className={styles.requiredToolsBox}>
                                  <div className={styles.requiredToolsHeader}>
                                    <WrenchIcon size={15} style={{ color: '#4f46e5' }} />
                                    <span>Required Tools & Equipment to Bring:</span>
                                  </div>
                                  <div className={styles.requiredToolsContent}>
                                    {b.jobs?.worker_instructions ||
                                      'Bring standard repair toolkit, safety gear, and replacement parts.'}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              /* CUSTOMER DESCRIBED ISSUE / PROBLEM Card (Shown for Direct Bookings) */
                              <div className={styles.directIssueCard}>
                                <div className={styles.directIssueHeader}>
                                  <div className={styles.directIssueIcon}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                      <polyline points="14 2 14 8 20 8" />
                                      <line x1="16" y1="13" x2="8" y2="13" />
                                      <line x1="16" y1="17" x2="8" y2="17" />
                                      <polyline points="10 9 9 9 8 9" />
                                    </svg>
                                  </div>
                                  <div>
                                    <span className={styles.directIssueTag}>CUSTOMER DESCRIBED ISSUE / PROBLEM</span>
                                    <div className={styles.directIssueTitle}>
                                      {jobTitle !== 'Speaker System Disassembly and Reassembly' ? jobTitle : (b.worker_trade ? `${b.worker_trade.replace('_', ' ').toUpperCase()} Service Order` : 'Direct Service Hire')}
                                    </div>
                                  </div>
                                </div>

                                <div className={styles.directIssueBox}>
                                  {b.notes || b.jobs?.ai_description || 'Customer placed a direct hire booking for home service. No photo uploaded. Please coordinate with customer on visit time and inspect problem area on arrival.'}
                                </div>

                                {/* Required Tools & Material Checklist for Worker */}
                                <div className={styles.requiredToolsBox}>
                                  <div className={styles.requiredToolsHeader}>
                                    <WrenchIcon size={15} style={{ color: '#4f46e5' }} />
                                    <span>Required Tools & Equipment to Bring:</span>
                                  </div>
                                  <div className={styles.requiredToolsContent}>
                                    {b.jobs?.worker_instructions ||
                                      'Bring standard repair toolkit, safety gear, and replacement parts.'}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Address & Live Interactive Map Box */}
                            <div className={styles.activeDetailsBox}>
                              <div className={styles.activeAddressHeader}>
                                <div className={styles.activeAddressItem}>
                                  <MapPinIcon size={16} style={{ color: '#4f46e5', flexShrink: 0, marginTop: '2px' }} />
                                  <div>
                                    <span className={styles.activeAddressLabel}>CUSTOMER SERVICE LOCATION</span>
                                    <div className={styles.activeAddressText}>{cleanAddress}</div>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanAddress)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.openGpsBtn}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                      <polygon points="3 11 22 2 13 21 11 13 3 11" />
                                    </svg>
                                    GPS Navigation
                                  </a>

                                  <button
                                    type="button"
                                    className={styles.toggleMapBtn}
                                    onClick={() => setOpenMaps((prev) => ({ ...prev, [b.id]: !prev[b.id] }))}
                                    title={openMaps[b.id] ? 'Hide Live Map' : 'Show Live Map'}
                                  >
                                    <span>{openMaps[b.id] ? 'Hide Map' : 'Show Map'}</span>
                                    <svg
                                      width="13"
                                      height="13"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      style={{ transform: openMaps[b.id] ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
                                    >
                                      <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                  </button>
                                </div>
                              </div>

                              {/* Embedded OpenStreetMap Live View (Collapsible map, closed by default) */}
                              {openMaps[b.id] && (
                                <div className={styles.activeMapEmbedWrap}>
                                  <iframe
                                    title="Customer Service Location Map"
                                    width="100%"
                                    height="190"
                                    frameBorder="0"
                                    scrolling="no"
                                    marginHeight={0}
                                    marginWidth={0}
                                    src="https://www.openstreetmap.org/export/embed.html?bbox=72.820%2C19.040%2C72.860%2C19.080&amp;layer=mapnik&amp;marker=19.055%2C72.835"
                                    style={{ borderRadius: '12px', border: '1px solid #cbd5e1', width: '100%' }}
                                  />
                                  <div className={styles.activeMapOverlayBadge}>
                                    <span className={styles.activeMapDot} />
                                    <span>Customer GPS Pin • {cleanCity}</span>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Action Footer Bar */}
                            <div className={styles.activeFooterBar}>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <a href={`tel:${phone}`} className={styles.callCustomerBtn}>
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.65 3.27 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.69a16 16 0 0 0 6.29 6.29l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                                  </svg>
                                  Call Customer: {phone}
                                </a>

                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ borderRadius: '10px', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                  onClick={() => {
                                    if (typeof window !== 'undefined') {
                                      window.dispatchEvent(new CustomEvent('fixitnow_open_chat', {
                                        detail: {
                                          bookingId: b.id,
                                          recipientName: b.profiles?.full_name || 'Customer',
                                          recipientAvatar: b.profiles?.avatar_url,
                                          jobTitle: b.jobs?.ai_problem_title || 'Service Repair',
                                        }
                                      }));
                                    }
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                  </svg>
                                  Message Customer
                                </button>
                              </div>

                              <div className={styles.activeRightGroup}>
                                {b.price_quoted && (
                                  <div className={styles.activePriceTag}>₹{b.price_quoted}</div>
                                )}
                                <button
                                  className={styles.markCompleteBtn}
                                  onClick={() => handleBookingAction(b.id, 'completed')}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"/>
                                  </svg>
                                  Mark Job Complete
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIconBadge}><WrenchIcon size={24} /></div>
                      <h3>No Active Jobs Right Now</h3>
                      <p>When you accept incoming requests, they will show up here with customer phone contact and full address details.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Completed History Tab */}
              {activeTab === 'history' && (
                <div className={styles.tabContent}>
                  {completedBookings.length > 0 ? (
                    <div className={styles.historyList}>
                      {completedBookings.map((b) => (
                        <div key={b.id} className={styles.historyCard}>
                          <div className={styles.historyLeft}>
                            <div className={styles.historyCheck}>✓</div>
                            <div>
                              <div className={styles.historyTitle}>{b.jobs?.ai_problem_title || 'Service Request'}</div>
                              <div className={styles.historyCustomer}>{b.profiles?.full_name || 'Customer'}</div>
                              <div className={styles.historyDate}>{b.booked_at ? new Date(b.booked_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Recently'}</div>
                            </div>
                          </div>
                          {b.price_quoted && (
                            <div className={styles.historyPrice}>₹{b.price_quoted}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : isDemoWorkerAccount ? (
                    <div className={styles.historyList}>
                      {[
                        { title: 'Kitchen Pipe Leak Repair', customer: 'Priya Mehta', date: '20 Jul 2025', price: 1800 },
                        { title: 'Bathroom Tap Replacement', customer: 'Arjun Singh', date: '16 Jul 2025', price: 950 },
                        { title: 'Overhead Tank Cleaning', customer: 'Neha Kapoor', date: '11 Jul 2025', price: 2500 },
                        { title: 'Drainage Blockage Fix', customer: 'Ravi Sharma', date: '5 Jul 2025', price: 1200 },
                      ].map((item, i) => (
                        <div key={i} className={styles.historyCard}>
                          <div className={styles.historyLeft}>
                            <div className={styles.historyCheck}>✓</div>
                            <div>
                              <div className={styles.historyTitle}>{item.title}</div>
                              <div className={styles.historyCustomer}>{item.customer}</div>
                              <div className={styles.historyDate}>{item.date}</div>
                            </div>
                          </div>
                          <div className={styles.historyPrice}>₹{item.price.toLocaleString('en-IN')}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIconBadge}>✓</div>
                      <h3>No Completed Job History</h3>
                      <p>Completed jobs will appear here with customer feedback and earnings receipts.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );

      case 'analytics-row':
        return (
          <div className={styles.twoCol} id="earnings-section">
            <div className={styles.card} style={{ height: '100%' }}>
              <div className={styles.cardHeader} style={{ paddingRight: '44px' }}>
                <div>
                  <h2 className={styles.cardTitle}>Weekly Revenue Analytics</h2>
                  <p className={styles.cardSub}>Earnings breakdown for the last 7 days</p>
                </div>
                <div className={styles.earningsTotalBadge} style={{ marginRight: '36px' }}>
                  ₹{totalWeekEarnings.toLocaleString('en-IN')}
                </div>
              </div>
              <EarningsChart data={weeklyEarnings} />
              <div className={styles.earningsFooter}>
                <span className={styles.earningsFooterItem}>
                  <span className={styles.greenDot} />
                  {peakDayLabel}
                </span>
                <span className={styles.earningsFooterItem}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                  {growthLabel}
                </span>
              </div>
            </div>
            <div className={styles.card} style={{ height: '100%' }}>
              <div className={styles.cardHeader} style={{ paddingRight: '44px' }}>
                <div>
                  <h2 className={styles.cardTitle}>Performance Reliability</h2>
                  <p className={styles.cardSub}>Your service quality metrics</p>
                </div>
                <AwardIcon size={22} style={{ color: '#4f46e5', marginRight: '36px' }} />
              </div>
              <div className={styles.ringsRow}>
                <RingProgress pct={performanceMetrics.completionRate} color="#10b981" label="COMPLETION" />
                <RingProgress pct={performanceMetrics.acceptanceRate} color="#4f46e5" label="ACCEPTANCE" />
                <RingProgress pct={performanceMetrics.onTimeRate} color="#f59e0b" label="ON-TIME" />
              </div>
              <div className={styles.responseTimePill}>
                <ClockIcon size={14} />
                Average response time to requests: <strong>{performanceMetrics.avgResponseText || `${performanceMetrics.avgResponseMin} mins`}</strong>
              </div>
            </div>
          </div>
        );

      case 'schedule-row':
        return (
          <div className={styles.twoCol}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>Upcoming Schedule</h2>
                  <p className={styles.cardSub}>Your scheduled repair appointments</p>
                </div>
                <CalendarIcon size={20} style={{ color: '#4f46e5' }} />
              </div>
              {acceptedBookings.filter(b => b.scheduled_at).length > 0 ? (
                <div className={styles.scheduleList}>
                  {acceptedBookings.filter(b => b.scheduled_at).map((b) => (
                    <div key={b.id} className={styles.scheduleItem}>
                      <div className={styles.scheduleDate}>
                        <div className={styles.scheduleDateDay}>
                          {new Date(b.scheduled_at).toLocaleDateString('en-IN', { day: '2-digit' })}
                        </div>
                        <div className={styles.scheduleDateMonth}>
                          {new Date(b.scheduled_at).toLocaleDateString('en-IN', { month: 'short' })}
                        </div>
                      </div>
                      <div className={styles.scheduleInfo}>
                        <div className={styles.scheduleTitle}>{b.jobs?.ai_problem_title || 'Service'}</div>
                        <div className={styles.scheduleCustomer}>{b.profiles?.full_name || 'Customer'}</div>
                        <div className={styles.scheduleTime}>
                          <ClockIcon size={12} />
                          {new Date(b.scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <span className={styles.scheduleBadge}>Confirmed</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.scheduleEmpty}>
                  <CalendarIcon size={26} style={{ color: '#94a3b8' }} />
                  <p>No scheduled appointments pending</p>
                  <p style={{ fontSize: '12px', color: '#94a3b8' }}>Accept requests with a scheduled time slot to see them listed here</p>
                </div>
              )}
            </div>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>Pro Growth Checklist</h2>
                  <p className={styles.cardSub}>Milestones to boost your job bookings</p>
                </div>
                <div style={{ background: '#fef3c7', width: '32px', height: '32px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
                    <path d="M9 18h6"/>
                    <path d="M10 22h4"/>
                  </svg>
                </div>
              </div>
              <div className={styles.tipsList}>
                {[
                  {
                    icon: (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                    ),
                    tip: 'Upload a clear profile photo to build high trust with homeowners.',
                    done: !!profile?.avatar_url,
                  },
                  {
                    icon: (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                      </svg>
                    ),
                    tip: 'Stay online during high-demand hours (8–11 AM, 5–8 PM).',
                    done: worker?.is_available,
                  },
                  {
                    icon: (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                    ),
                    tip: 'Ask satisfied customers to leave a review right after completing a repair.',
                    done: totalReviews >= 5,
                  },
                  {
                    icon: (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                      </svg>
                    ),
                    tip: 'Set your exact city in Profile Settings to appear in local search results.',
                    done: !!profile?.city,
                  },
                  {
                    icon: (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                      </svg>
                    ),
                    tip: 'Write a detailed bio highlighting your experience and specialties.',
                    done: !!worker?.bio,
                  },
                  {
                    icon: (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                    ),
                    tip: 'Respond to incoming requests within 15 minutes for top placement.',
                    done: performanceMetrics.avgResponseMin <= 15,
                  },
                ].map(({ icon, tip, done }, i) => (
                  <div key={i} className={`${styles.tipItem} ${done ? styles.tipDone : ''}`}>
                    <span className={styles.tipIcon}>
                      {done ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      ) : (
                        icon
                      )}
                    </span>
                    <span className={styles.tipText}>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'reviews-section':
      default:
        return (
          <div className={styles.section} id="reviews-section" style={{ background: '#ffffff', borderRadius: '16px', padding: '24px', border: '1.5px solid #cbd5e1' }}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                Customer Reviews &amp; Ratings
                <span className={styles.badgeCount}>{reviews.length}</span>
              </h2>
              <div className={styles.ratingOverall}>
                <Stars rating={avgRating} />
                <span className={styles.ratingOverallNum}>{typeof avgRating === 'number' ? avgRating.toFixed(1) : avgRating} / 5</span>
              </div>
            </div>
            <div className={styles.reviewsGrid}>
              {reviews.map((r) => {
                const reviewInitials = r.customer_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || '?';
                return (
                  <div key={r.id} className={styles.reviewCard}>
                    <div className={styles.reviewHeader}>
                      <div className={styles.reviewAvatarFallback}>{reviewInitials}</div>
                      <div className={styles.reviewAuthorMeta}>
                        <strong>{r.customer_name}</strong>
                        <span className={styles.reviewDate}>{r.date}</span>
                      </div>
                      <div className={styles.reviewStarsRow}>
                        {Array.from({ length: 5 }, (_, i) => (
                          <StarIcon key={i} size={14} style={{ color: i < r.rating ? '#fbbf24' : '#cbd5e1', opacity: 1 }} />
                        ))}
                      </div>
                    </div>
                    <p className={styles.reviewText}>&ldquo;{r.comment}&rdquo;</p>
                  </div>
                );
              })}
            </div>
          </div>
        );
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {/* Real-time New Booking Request Banner Alert */}
        {newBookingAlert && (
          <div
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              color: '#ffffff',
              padding: '16px 20px',
              borderRadius: '16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              boxShadow: '0 10px 25px -5px rgba(79, 70, 229, 0.4)',
              border: '2px solid rgba(255, 255, 255, 0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ fontSize: '28px', background: 'rgba(255, 255, 255, 0.2)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                🔔
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                  New Direct Booking Request!
                </h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.88rem', opacity: 0.95 }}>
                  {newBookingAlert.profiles?.full_name || 'A customer'} requested your service ({newBookingAlert.workers?.trade || 'repair'})
                  {newBookingAlert.price_quoted ? ` — ₹${newBookingAlert.price_quoted}` : ''}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
              <button
                className="btn btn-primary"
                style={{ background: '#10b981', borderColor: '#10b981', color: '#fff', fontWeight: 700, padding: '8px 18px', borderRadius: '10px', cursor: 'pointer' }}
                onClick={() => handleBookingAction(newBookingAlert.id, 'accepted')}
              >
                ✓ Accept Booking
              </button>
              <button
                className="btn btn-secondary"
                style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '10px', cursor: 'pointer' }}
                onClick={() => handleBookingAction(newBookingAlert.id, 'rejected')}
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {/* ── Hero Console Header Card ─────────────────────────── */}
        <div className={styles.headerCard}>
          <div className={styles.headerLeft}>
            <div className={styles.workerAvatarWrap}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name} className={styles.workerAvatar} />
              ) : (
                <div className={styles.workerAvatarFallback}>{initials}</div>
              )}
              <span className={`${styles.onlineDot} ${worker?.is_available ? styles.onlineDotActive : styles.onlineDotOff}`} />
            </div>
            <div className={styles.headerMeta}>
              <h1 className={styles.title}>
                {profile?.full_name || 'Worker Console'}
                {worker?.is_verified && <CheckBadgeIcon size={20} style={{ color: '#10b981' }} />}
              </h1>
              <div className={styles.subMeta}>
                <Link
                  href="/profile?tab=worker"
                  className={styles.tradeBadge}
                  style={{ background: trade.bg, color: trade.color, textDecoration: 'none' }}
                  title="Click to edit service profile & trade specialty"
                >
                  {getTradeIcon(worker?.trade || 'other', 14)} {trade.label} Specialist
                </Link>
                <Link
                  href="/profile?tab=location"
                  className={styles.locationBadge}
                  style={{ textDecoration: 'none' }}
                  title="Click to edit location address & GPS city"
                >
                  <MapPinIcon size={12} /> {profile?.city || 'Set Location'}
                </Link>
                <span className={styles.ratingBadge}>
                  <StarIcon size={12} style={{ color: '#b45309' }} />
                  {avgRating.toFixed ? avgRating.toFixed(1) : avgRating}
                  <span style={{ color: '#78350f', fontWeight: 500 }}>({totalReviews})</span>
                </span>
              </div>
            </div>
          </div>

          <div className={styles.headerRight}>
            {/* Availability Toggle Switch */}
            <div className={styles.availToggleWrap}>
              <span className={styles.availToggleLabel}>
                {worker?.is_available ? '🟢 Available Online' : '⚫ Offline Mode'}
              </span>
              <label className={styles.toggleSwitch}>
                <input
                  type="checkbox"
                  checked={worker?.is_available || false}
                  onChange={toggleAvailability}
                  className={styles.toggleInput}
                />
                <span className={styles.toggleSlider} />
              </label>
            </div>

            {/* Quick Actions Bar */}
            <div className={styles.quickActions}>
              <Link href="/profile?tab=account" className={styles.quickBtn}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit Profile
              </Link>
              <button className={styles.quickBtn} onClick={copyProfileLink}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                {copyMsg || 'Share Profile'}
              </button>
              <Link href={`/worker/${worker?.id || profile?.id || 'w1'}`} className={styles.quickBtn} target="_blank">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                View Public
              </Link>
            </div>
          </div>
        </div>

        {/* ── Status Alert Banner ─────────────────────────────── */}
        <div className={`${styles.statusBanner} ${worker?.is_available ? styles.statusOnline : styles.statusOffline}`}>
          <span className={styles.bannerIndicator} />
          <div className={styles.bannerText}>
            {worker?.is_available ? (
              <p>
                <strong>You are online and visible!</strong> Customers looking for {trade.label.toLowerCase()} services in <strong>{profile?.city || 'your area'}</strong> can view your profile and send job requests.
              </p>
            ) : (
              <p>
                <strong>Offline Mode.</strong> Your profile is hidden from search results. Toggle online availability above when you&apos;re ready to receive jobs.
              </p>
            )}
          </div>
          {pendingBookings.length > 0 && (
            <span className={styles.urgentPill}>
              🔔 {pendingBookings.length} new {pendingBookings.length === 1 ? 'request' : 'requests'}
            </span>
          )}
        </div>

        {/* ── Metrics Cards Grid (3 Columns x 2 Rows, Draggable) ─ */}
        <div className={styles.statsGrid}>
          {statCardOrder.map((cardId, index) => (
            <DraggableCard
              key={cardId}
              id={cardId}
              index={index}
              totalCards={statCardOrder.length}
              onMove={moveStatCard}
            >
              {renderStatCard(cardId)}
            </DraggableCard>
          ))}
        </div>

        {/* ── Main Re-orderable Section Blocks ──────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '24px' }}>
          {mainSectionOrder.map((sectionId, index) => (
            <DraggableCard
              key={sectionId}
              id={sectionId}
              index={index}
              totalCards={mainSectionOrder.length}
              onMove={moveMainSection}
            >
              {renderMainSection(sectionId)}
            </DraggableCard>
          ))}
        </div>

        {/* ── Profile Completion Callout Banner ─────────────────── */}
        {(!profile?.city || !profile?.avatar_url || !worker?.bio) && (
          <div className={styles.completionBanner}>
            <div className={styles.completionLeft}>
              <span className={styles.completionIcon}>🚀</span>
              <div>
                <strong>Complete your profile to receive 3× more job requests!</strong>
                <p>Workers with completed photos, location, and bio get priority matching from homeowners.</p>
              </div>
            </div>
            <Link href="/profile?tab=worker" className="btn btn-primary btn-sm">
              Complete Profile Now →
            </Link>
          </div>
        )}

        {/* ── Media Lightbox Modal (Photo & Video Support) ── */}
        {selectedPhoto && (() => {
          const isVideoMedia = selectedPhoto.startsWith('data:video/') || selectedPhoto.includes('.mp4') || selectedPhoto.includes('.webm') || selectedPhoto.includes('video');
          return (
            <div className={styles.photoLightboxOverlay} onClick={() => setSelectedPhoto(null)}>
              <div className={styles.photoLightboxContent} onClick={(e) => e.stopPropagation()}>
                <button className={styles.photoLightboxClose} onClick={() => setSelectedPhoto(null)}>✕</button>
                {isVideoMedia ? (
                  <video
                    src={selectedPhoto}
                    controls
                    autoPlay
                    playsInline
                    className={styles.photoLightboxImg}
                    style={{ maxHeight: '75vh', maxWidth: '88vw', borderRadius: '16px', border: '2px solid rgba(255,255,255,0.2)', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}
                  />
                ) : (
                  <img src={selectedPhoto} alt="Enlarged Problem Damage" className={styles.photoLightboxImg} />
                )}
                <div className={styles.photoLightboxCap}>
                  {isVideoMedia ? '🎥 Customer Inspection Video — Click outside to close' : '📸 Scanned Damage Photo — Click outside to close'}
                </div>
              </div>
            </div>
          );
        })()}



      </div>
    </div>
  );
}

export default function WorkerDashboardPage() {
  return (
    <Suspense fallback={
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.loadingState}>
            <div className="spinner spinner-lg" />
            <p>Loading worker console...</p>
          </div>
        </div>
      </div>
    }>
      <WorkerDashboardContent />
    </Suspense>
  );
}
