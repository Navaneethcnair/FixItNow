'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { TRADE_CONFIG, TradeType } from '@/lib/types';
import { StarIcon, AwardIcon, BuildingIcon, CheckBadgeIcon, getTradeIcon } from '@/components/Icons';
import CustomDatePicker from '@/components/CustomDatePicker';
import CustomTimePicker from '@/components/CustomTimePicker';
import BookingChatDrawer from '@/components/BookingChatDrawer';
import { useLanguage } from '@/context/LanguageContext';
import styles from './book.module.css';

function BookContent() {
  const { t } = useLanguage();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobId = params.jobId as string;
  const workerId = searchParams.get('workerId');

  const [user, setUser] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [worker, setWorker] = useState<any>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [issueNotes, setIssueNotes] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card' | ''>('');
  const [booking, setBooking] = useState(false);
  const [done, setDone] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [bookedBookingId, setBookedBookingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const handleNextStep = () => {
    if (!scheduledDate) {
      setError('Please select a Visit Date to proceed.');
      return;
    }
    if (!scheduledTime) {
      setError('Please select a Preferred Time slot to proceed.');
      return;
    }
    const [h, m] = scheduledTime.split(':').map(Number);
    if (h < 8 || h > 20 || (h === 20 && m > 0)) {
      setError('Preferred time must be between 8:00 AM and 8:00 PM.');
      return;
    }
    setError('');
    setStep(2);
  };

  const detectLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setAddress(`Near current location (${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)})`);
        },
        () => {}
      );
    }
  };

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      try {
        const savedDate = sessionStorage.getItem('book_date');
        const savedTime = sessionStorage.getItem('book_time');
        if (savedDate) {
          setScheduledDate(savedDate);
          sessionStorage.removeItem('book_date');
        }
        if (savedTime) {
          setScheduledTime(savedTime);
          sessionStorage.removeItem('book_time');
        }
      } catch {}

      // Fetch job data from sessionStorage or API (works in local mode)
      if (jobId && jobId !== 'new') {
        try {
          const cached = sessionStorage.getItem(`job-${jobId}`);
          if (cached) {
            setJob(JSON.parse(cached));
          } else {
            const res = await fetch(`/api/jobs/${jobId}`);
            const data = await res.json();
            if (res.ok && data.job) setJob(data.job);
          }
        } catch {
          // Job not found, that's okay
        }
      }
      // Fetch worker from the API or session
      if (workerId) {
        let foundWorker: any = null;
        try {
          const res = await fetch('/api/workers');
          const data = await res.json();
          foundWorker = (data.workers || []).find((w: any) => w.id === workerId);
        } catch {}

        if (!foundWorker && typeof window !== 'undefined') {
          try {
            const raw = window.localStorage.getItem('fixitnow_user');
            if (raw) {
              const u = JSON.parse(raw);
              if (u.id === workerId || workerId === 'w1' || u.user_metadata?.role === 'worker') {
                foundWorker = {
                  id: workerId,
                  trade: u.user_metadata?.trade || u.trade || 'plumber',
                  hourly_rate: u.user_metadata?.hourly_rate || 350,
                  rating: 4.9,
                  total_reviews: 18,
                  is_available: true,
                  is_verified: true,
                  profiles: {
                    full_name: u.user_metadata?.full_name || u.full_name || 'Pro Worker',
                    city: u.user_metadata?.city || 'Mumbai',
                  }
                };
              }
            }
          } catch {}
        }

        if (!foundWorker) {
          foundWorker = {
            id: workerId,
            trade: 'plumber',
            hourly_rate: 350,
            rating: 4.8,
            total_reviews: 24,
            is_available: true,
            is_verified: true,
            profiles: {
              full_name: 'Verified Pro Worker',
              city: 'Mumbai',
            }
          };
        }

        setWorker(foundWorker);
      }
      setLoading(false);
    };
    checkAuthAndFetch();
  }, [jobId, workerId, router, supabase]);

  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);
  const [bookingStatus, setBookingStatus] = useState<string>('requested');

  useEffect(() => {
    if (!done) return;
    const pollStatus = async () => {
      try {
        const res = await fetch('/api/bookings?role=customer');
        const d = await res.json();
        if (d.bookings && Array.isArray(d.bookings)) {
          const found = createdBookingId
            ? d.bookings.find((b: any) => b.id === createdBookingId)
            : d.bookings[0];
          if (found?.status) {
            setBookingStatus(found.status);
          }
        }
      } catch {}
    };

    pollStatus();
    const interval = setInterval(pollStatus, 3000);
    return () => clearInterval(interval);
  }, [done, createdBookingId]);

  const handleBook = async () => {
    if (!workerId) return;
    if (!scheduledDate) {
      setError('Please select a Visit Date.');
      setStep(1);
      return;
    }
    if (!scheduledTime) {
      setError('Please select a Preferred Time slot.');
      setStep(1);
      return;
    }
    if (!address.trim()) {
      setError('Please enter your Service Address to complete booking.');
      return;
    }
    if (!pincode.trim()) {
      setError('Please enter your Pincode / City to complete booking.');
      return;
    }
    if (!paymentMethod) {
      setError('Please select a Payment Method to complete booking.');
      return;
    }
    setBooking(true);
    setError('');

    try {
      const datePart = scheduledDate || new Date().toISOString().split('T')[0];
      const timePart = scheduledTime || '10:00';
      const cleanTime = timePart.length === 5 ? `${timePart}:00` : timePart;
      let scheduledAt: string | null = null;
      try {
        const iso = new Date(`${datePart}T${cleanTime}`).toISOString();
        scheduledAt = iso;
      } catch {
        scheduledAt = `${datePart} ${cleanTime}`;
      }

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: jobId !== 'new' ? jobId : (job?.id || null),
          jobDetails: job || null,
          workerId,
          workerName: worker?.profiles?.full_name || null,
          workerTrade: worker?.trade || null,
          scheduledAt,
          priceQuoted: worker?.hourly_rate || null,
          notes: issueNotes || null,
          address: address || null,
          pincode: pincode || null,
          paymentMethod: paymentMethod || 'cash',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Booking failed');
      if (data.booking?.id) {
        setCreatedBookingId(data.booking.id);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('fixitnow_booking_change'));
      }
      setDone(true);
    } catch (err: any) {
      setError(err.message);
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={`container ${styles.container}`}>
          <div className={styles.loading}><div className="spinner spinner-lg" /></div>
        </div>
      </div>
    );
  }

  const trade = worker ? TRADE_CONFIG[worker.trade as TradeType] || TRADE_CONFIG.other : null;
  const initials = worker?.profiles?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || '?';

  if (done) {
    const isAccepted = bookingStatus === 'accepted';
    const isCompleted = bookingStatus === 'completed';

    return (
      <div className={styles.page}>
        <div className={`container ${styles.container}`}>
          <div className={styles.successCard}>
            {/* Animated Checkmark Badge */}
            <div className={styles.successIconBadge}>
              <div className={styles.successIconPulse} />
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={styles.checkSvg}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <div className={styles.successHeader}>
              <span className={styles.successTag} style={isAccepted ? { background: '#ecfdf5', color: '#059669', borderColor: '#a7f3d0' } : {}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: '4px' }}>
                  <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2z" />
                </svg>
                {isAccepted ? 'Worker Accepted!' : 'Request Sent'}
              </span>
              <h1 className={styles.successTitle}>{isAccepted ? 'Worker Confirmed Your Booking!' : t('book.confirmed_title')}</h1>
              <p className={styles.successDesc}>
                {isAccepted ? 'The worker has accepted your job request and is preparing for your visit.' : t('book.confirmed_subtitle')}
              </p>
            </div>

            {/* Worker & Booking Summary Box */}
            {worker && (
              <div className={styles.bookingDetailBox}>
                <div className={styles.detailWorkerRow}>
                  <div className={styles.detailAvatar}>
                    {worker.profiles?.avatar_url ? (
                      <img src={worker.profiles.avatar_url} alt="" />
                    ) : (
                      <div className={styles.detailAvatarFb}>{initials}</div>
                    )}
                  </div>
                  <div className={styles.detailWorkerInfo}>
                    <div className={styles.detailWorkerName}>{worker.profiles?.full_name}</div>
                    {trade && (
                      <span className={styles.detailTradeBadge} style={{ background: trade.bg, color: trade.color }}>
                        {getTradeIcon(worker.trade, 12)} {trade.label}
                      </span>
                    )}
                  </div>
                  <div className={styles.detailPrice}>
                    ₹{worker.hourly_rate}<span>/hr</span>
                  </div>
                </div>

                <div className={styles.detailMetaGrid}>
                  {scheduledDate && (
                    <div className={styles.detailMetaItem}>
                      <span className={styles.detailMetaLabel}>{t('book.visit_date')}</span>
                      <span className={styles.detailMetaVal}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '4px', color: 'var(--primary)' }}>
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        {scheduledDate}
                      </span>
                    </div>
                  )}
                  {scheduledTime && (
                    <div className={styles.detailMetaItem}>
                      <span className={styles.detailMetaLabel}>{t('book.preferred_time')}</span>
                      <span className={styles.detailMetaVal}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '4px', color: 'var(--primary)' }}>
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        {scheduledTime}
                      </span>
                    </div>
                  )}
                  <div className={styles.detailMetaItem}>
                    <span className={styles.detailMetaLabel}>Current Status</span>
                    <span className={styles.detailMetaStatus} style={isAccepted ? { color: '#059669', background: '#ecfdf5' } : {}}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: '4px' }}>
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                      {isAccepted ? '✓ Accepted by Worker' : isCompleted ? '✓ Completed' : 'Pending Confirmation'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Custom Status Tracker */}
            <div className={styles.statusTracker}>
              <div className={`${styles.trackerStep} ${styles.stepCompleted}`}>
                <div className={styles.stepCircle}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <span className={styles.stepTitle}>Requested</span>
              </div>
              <div className={`${styles.trackerLine} ${styles.lineActive}`} />

              <div className={`${styles.trackerStep} ${styles.stepCompleted}`}>
                <div className={styles.stepCircle}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <span className={styles.stepTitle}>Notified</span>
              </div>
              <div className={`${styles.trackerLine} ${isAccepted || isCompleted ? styles.lineActive : ''}`} />

              <div className={`${styles.trackerStep} ${isAccepted || isCompleted ? styles.stepCompleted : styles.stepActive}`}>
                <div className={styles.stepCircle}>
                  {isAccepted || isCompleted ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : '3'}
                </div>
                <span className={styles.stepTitle}>Accepted</span>
              </div>
              <div className={`${styles.trackerLine} ${isCompleted ? styles.lineActive : ''}`} />

              <div className={`${styles.trackerStep} ${isCompleted ? styles.stepCompleted : ''}`}>
                <div className={styles.stepCircle}>4</div>
                <span className={styles.stepTitle}>Completed</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className={styles.successActions} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                style={{ flex: 1, minWidth: '200px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={() => setShowChat(true)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Message Worker Now
              </button>
              <Link href="/dashboard" className="btn btn-secondary btn-lg" style={{ flex: 1, minWidth: '160px' }}>
                {t('book.go_to_dashboard')}
              </Link>
            </div>
          </div>
        </div>

        {/* Real-Time Booking Chat Drawer */}
        {showChat && (
          <BookingChatDrawer
            bookingId={createdBookingId || 'local-booking-1'}
            currentUserId="local-user"
            currentUserRole="customer"
            recipientName={worker?.profiles?.full_name || 'Assigned Worker'}
            recipientAvatar={worker?.profiles?.avatar_url}
            jobTitle={job?.ai_problem_title || 'Service Repair'}
            isOpen={showChat}
            onClose={() => setShowChat(false)}
          />
        )}
      </div>
    );
  }


  return (
    <div className={styles.page}>
      <div className={`container ${styles.container}`}>
        {/* Header */}
        <div className={styles.header}>
          <span className="section-tag">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '5px' }}>
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            </svg>
            {t('book.tag')}
          </span>
          <h1 className="section-title">{t('book.title')}</h1>
          <p className={styles.headerSub}>{t('book.subtitle')}</p>
        </div>

        <div className={styles.bookingGrid}>
          {/* Left Column: Worker Profile & Job Summary */}
          <div className={styles.summaryCard}>
            {worker && (
              <div className={styles.workerSummaryWrap}>
                {/* Top Profile Banner */}
                <div className={styles.workerSummaryTop}>
                  <Link href={`/worker/${worker.id}`} className={styles.workerAvatarLink} title={`View ${worker.profiles?.full_name || 'Worker'}'s Profile`}>
                    <div className={styles.workerAvatar}>
                      {worker.profiles?.avatar_url ? (
                        <img src={worker.profiles.avatar_url} alt="" />
                      ) : (
                        <div className={styles.workerAvatarFb}>{initials}</div>
                      )}
                      {worker.is_available && <span className={styles.onlineDot} title="Worker is online & available" />}
                    </div>
                  </Link>

                  <div className={styles.workerMetaInfo}>
                    <div className={styles.workerNameRow}>
                      <Link href={`/worker/${worker.id}`} title={`View ${worker.profiles?.full_name || 'Worker'}'s Profile`}>
                        <h3 className={styles.workerName}>{worker.profiles?.full_name}</h3>
                      </Link>
                      {worker.is_verified && (
                        <span className={styles.verifiedBadge}>
                          <CheckBadgeIcon size={12} /> {t('card.verified')}
                        </span>
                      )}
                    </div>

                    {trade && (
                      <div className={styles.tradeBadge} style={{ background: trade.bg, color: trade.color }}>
                        {getTradeIcon(worker.trade, 13)} {trade.label}
                      </div>
                    )}
                  </div>

                  <div className={styles.workerRateBox}>
                    <span className={styles.rateLabel}>{t('book.hourly_rate')}</span>
                    <div className={styles.rateValue}>₹{worker.hourly_rate}<span>/hr</span></div>
                  </div>
                </div>

                {/* 3 Grid Stat Cards */}
                <div className={styles.workerStatsGrid}>
                  <div className={styles.statCardItem}>
                    <div className={styles.statIconWrap} style={{ color: '#f59e0b', background: '#fef3c7' }}>
                      <StarIcon size={15} />
                    </div>
                    <div className={styles.statMetaText}>
                      <span className={styles.statMainVal}>{worker.rating?.toFixed(1) || '4.8'}</span>
                      <span className={styles.statSubLbl}>({worker.total_reviews || 50} {t('book.reviews')})</span>
                    </div>
                  </div>

                  <div className={styles.statCardItem}>
                    <div className={styles.statIconWrap} style={{ color: '#6366f1', background: '#e0e7ff' }}>
                      <AwardIcon size={15} />
                    </div>
                    <div className={styles.statMetaText}>
                      <span className={styles.statMainVal}>{worker.experience_years} Years</span>
                      <span className={styles.statSubLbl}>{t('book.experience')}</span>
                    </div>
                  </div>

                  {worker.profiles?.city && (
                    <div className={styles.statCardItem}>
                      <div className={styles.statIconWrap} style={{ color: '#10b981', background: '#d1fae5' }}>
                        <BuildingIcon size={15} />
                      </div>
                      <div className={styles.statMetaText}>
                        <span className={styles.statMainVal}>{worker.profiles.city}</span>
                        <span className={styles.statSubLbl}>{t('book.locality')}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Worker Bio Quote Box */}
                {worker.bio && (
                  <div className={styles.bioQuoteBox}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.25, flexShrink: 0, marginTop: '2px' }}>
                      <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/>
                    </svg>
                    <p className={styles.workerBio}>&ldquo;{worker.bio}&rdquo;</p>
                  </div>
                )}
              </div>
            )}

            <div className={styles.sectionDivider} />

            {/* Service / Problem Details Box */}
            <div className={styles.jobSummary}>
              <div className={styles.jobSummaryHeader}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--primary)' }}>
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                </svg>
                <h4 className={styles.jobSummaryTitle}>{t('book.service_summary')}</h4>
              </div>

              {job ? (
                <div className={styles.jobContentBox}>
                  <p className={styles.jobTitle}>{job.ai_problem_title || 'Custom Service Request'}</p>
                  {job.ai_description && <p className={styles.jobDesc}>{job.ai_description}</p>}
                  {job.ai_severity && (
                    <span className={`badge badge-${job.ai_severity}`} style={{ width: 'fit-content', marginTop: '6px' }}>
                      ⚡ {job.ai_severity.charAt(0).toUpperCase() + job.ai_severity.slice(1)} Priority
                    </span>
                  )}
                </div>
              ) : (
                <div className={styles.jobContentBox}>
                  <p className={styles.jobTitle}>{trade ? `${trade.label} Service` : 'Home Service'}</p>
                  <p className={styles.jobDesc}>
                    Direct booking request dispatched to <strong>{worker?.profiles?.full_name || 'the professional'}</strong>.
                  </p>
                </div>
              )}
            </div>

            {/* Trust Badges Bar */}
            <div className={styles.trustBadgesRow}>
              <div className={styles.trustItem}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#10b981' }}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span>{t('book.verified_background')}</span>
              </div>
              <div className={styles.trustItem}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#6366f1' }}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span>{t('book.fair_price_guarantee')}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Multi-step Form */}
          <div className={styles.scheduleCard}>
            <div className={styles.scheduleCardHeader}>
              <h3 className={styles.scheduleTitle}>
                {step === 1 ? t('book.step1_header') : t('book.step2_header')}
              </h3>
              <span className={styles.stepBadge}>{t('book.step_badge').replace('{step}', String(step))}</span>
            </div>

            {step === 1 ? (
              <>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--primary)' }}>
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    {t('book.visit_date')}
                  </label>
                  <CustomDatePicker
                    value={scheduledDate}
                    onChange={setScheduledDate}
                    minDate={new Date().toISOString().split('T')[0]}
                    placeholder="Select date..."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--primary)' }}>
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {t('book.preferred_time')}
                  </label>
                  <CustomTimePicker
                    value={scheduledTime}
                    onChange={setScheduledTime}
                    placeholder="Select preferred time..."
                  />
                </div>

                {/* Optional Issue / Problem Box */}
                <div className={styles.issueBoxWrap}>
                  <div className={styles.issueHeaderRow}>
                    <label className={styles.issueLabel}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)', verticalAlign: '-2px', marginRight: '6px' }}>
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      {t('book.describe_issue')}
                    </label>
                    <span className={styles.optionalBadge}>{t('book.optional')}</span>
                  </div>

                  <textarea
                    className={styles.issueTextarea}
                    rows={3}
                    value={issueNotes}
                    onChange={(e) => setIssueNotes(e.target.value)}
                    placeholder={t('book.issue_placeholder')}
                    maxLength={300}
                  />
                </div>

                {/* Price Summary Breakdown Box */}
                <div className={styles.priceBreakdownBox}>
                  <div className={styles.priceRow}>
                    <span>{t('book.hourly_rate')}</span>
                    <strong>₹{worker?.hourly_rate || '—'}/hr</strong>
                  </div>
                  <div className={styles.priceRow}>
                    <span>{t('book.booking_fee')}</span>
                    <strong style={{ color: '#10b981' }}>{t('book.free')}</strong>
                  </div>
                  <div className={styles.priceRowTotal}>
                    <span>{t('book.est_rate')}</span>
                    <span className={styles.priceTotalVal}>₹{worker?.hourly_rate || '—'}<span>/hr</span></span>
                  </div>
                </div>

                {error && <div className="alert alert-error" style={{ margin: '8px 0' }}><span>⚠️</span> {error}</div>}

                {!user ? (
                  <button
                    className={`btn btn-primary btn-lg btn-full ${styles.confirmBtn}`}
                    onClick={() => {
                      if (!scheduledDate || !scheduledTime) {
                        setError('Please select both a Visit Date and Preferred Time before proceeding.');
                        return;
                      }
                      try {
                        if (scheduledDate) sessionStorage.setItem('book_date', scheduledDate);
                        if (scheduledTime) sessionStorage.setItem('book_time', scheduledTime);
                      } catch {}
                      router.push(`/auth/login?redirect=/book/${jobId}?workerId=${workerId}`);
                    }}
                  >
                    {t('book.sign_in_continue')}
                  </button>
                ) : (
                  <button
                    className={`btn btn-primary btn-lg btn-full ${styles.confirmBtn}`}
                    onClick={handleNextStep}
                  >
                    {t('book.next_step')}
                  </button>
                )}
              </>
            ) : (
              <>
                {/* STEP 2: Location & Payment Method */}
                <div className="form-group">
                  <div className={styles.labelWithAction}>
                    <label className={styles.fieldLabel}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--primary)' }}>
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                      </svg>
                      {t('book.service_address')}
                    </label>
                    <button
                      type="button"
                      onClick={detectLocation}
                      className={styles.gpsDetectBtn}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                      </svg>
                      {t('book.detect_gps')}
                    </button>
                  </div>
                  <input
                    type="text"
                    className={styles.step2Input}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={t('book.address_placeholder')}
                    style={error && !address.trim() ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                  />
                </div>

                <div className="form-group">
                  <label className={styles.fieldLabel}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--primary)' }}>
                      <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
                      <path d="M9 22v-4h6v4"/>
                      <path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>
                    </svg>
                    {t('book.pincode_city')}
                  </label>
                  <input
                    type="text"
                    className={styles.step2Input}
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder={t('book.pincode_placeholder')}
                    style={error && !pincode.trim() ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                  />
                </div>

                {/* Payment Method Selector */}
                <div className="form-group">
                  <label className={styles.fieldLabel}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--primary)' }}>
                      <rect x="2" y="5" width="20" height="14" rx="2"/>
                      <line x1="2" y1="10" x2="22" y2="10"/>
                    </svg>
                    {t('book.payment_method')}
                  </label>
                  <div className={styles.paymentOptionsWrap} style={error && !paymentMethod ? { border: '1.5px dashed #ef4444', padding: '6px', borderRadius: '14px', background: '#fff5f5' } : {}}>
                    <div
                      className={`${styles.paymentCard} ${paymentMethod === 'cash' ? styles.paymentActive : ''}`}
                      onClick={() => { setPaymentMethod('cash'); setError(''); }}
                    >
                      <div className={styles.paymentIconBox} style={{ background: '#ecfdf5', color: '#059669' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="6" width="20" height="12" rx="2"/>
                          <circle cx="12" cy="12" r="3"/>
                          <path d="M6 12h.01M18 12h.01"/>
                        </svg>
                      </div>

                      <div className={styles.paymentMeta}>
                        <span className={styles.paymentTitle}>{t('book.cash_payment')}</span>
                        <span className={styles.paymentSub}>{t('book.cash_desc')}</span>
                      </div>

                      <div className={styles.paymentRadio}>
                        {paymentMethod === 'cash' && <span className={styles.radioDot} />}
                      </div>
                    </div>

                    <div
                      className={`${styles.paymentCard} ${paymentMethod === 'upi' ? styles.paymentActive : ''}`}
                      onClick={() => { setPaymentMethod('upi'); setError(''); }}
                    >
                      <div className={styles.paymentIconBox} style={{ background: '#eff6ff', color: '#2563eb' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                        </svg>
                      </div>

                      <div className={styles.paymentMeta}>
                        <span className={styles.paymentTitle}>{t('book.upi_payment')}</span>
                        <span className={styles.paymentSub}>{t('book.upi_desc')}</span>
                      </div>

                      <div className={styles.paymentRadio}>
                        {paymentMethod === 'upi' && <span className={styles.radioDot} />}
                      </div>
                    </div>

                    <div
                      className={`${styles.paymentCard} ${paymentMethod === 'card' ? styles.paymentActive : ''}`}
                      onClick={() => { setPaymentMethod('card'); setError(''); }}
                    >
                      <div className={styles.paymentIconBox} style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                          <line x1="1" y1="10" x2="23" y2="10"/>
                        </svg>
                      </div>

                      <div className={styles.paymentMeta}>
                        <span className={styles.paymentTitle}>{t('book.card_payment')}</span>
                        <span className={styles.paymentSub}>{t('book.card_desc')}</span>
                      </div>

                      <div className={styles.paymentRadio}>
                        {paymentMethod === 'card' && <span className={styles.radioDot} />}
                      </div>
                    </div>
                  </div>
                </div>

                {error && <div className="alert alert-error"><span>⚠️</span> {error}</div>}

                <div className={styles.step2Actions}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setStep(1)}
                    style={{ borderRadius: '12px' }}
                  >
                    {t('book.back')}
                  </button>
                  <button
                    type="button"
                    className={`btn btn-primary btn-lg ${styles.confirmBtn}`}
                    onClick={handleBook}
                    disabled={booking}
                    style={{ flex: 1 }}
                  >
                    {booking ? <><span className="spinner" /> {t('book.booking_in_progress')}</> : `${t('book.confirm_cta')}`}
                  </button>
                </div>
              </>
            )}

            <p className={styles.note}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: '4px', color: '#10b981' }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              {t('book.cancellation_note')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner spinner-lg" /></div>}>
      <BookContent />
    </Suspense>
  );
}
