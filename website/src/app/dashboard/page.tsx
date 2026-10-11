'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TRADE_CONFIG, TradeType } from '@/lib/types';
import styles from './dashboard.module.css';
import { useLanguage } from '@/context/LanguageContext';
import BookingChatDrawer from '@/components/BookingChatDrawer';

export default function CustomerDashboardPage() {
  const { t } = useLanguage();
  const [jobs, setJobs] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [tab, setTab] = useState<'jobs' | 'bookings'>('jobs');
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [activeChatBooking, setActiveChatBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();

  // Feedback & Review Modal State
  const [feedbackModalBooking, setFeedbackModalBooking] = useState<any>(null);
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackComment, setFeedbackComment] = useState<string>('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState<boolean>(false);
  const [feedbackSuccessMsg, setFeedbackSuccessMsg] = useState<string>('');
  const [reviewedBookingIds, setReviewedBookingIds] = useState<Record<string, number>>({});

  const handleFeedbackSubmit = async (booking: any) => {
    if (!booking) return;
    setFeedbackSubmitting(true);
    setFeedbackSuccessMsg('');

    const workerId = booking.worker_id || booking.workers?.id || 'w1';
    const customerId = profile?.id || 'local-user';

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worker_id: workerId,
          customer_id: customerId,
          booking_id: booking.id,
          rating: feedbackRating,
          comment: feedbackComment.trim() || 'Great service! Completed work efficiently.',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setReviewedBookingIds(prev => ({
          ...prev,
          [booking.id]: feedbackRating
        }));

        setFeedbackSuccessMsg('🎉 Thank you! Your review has been saved and published to the worker profile.');

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('fixitnow_booking_change'));
        }

        setTimeout(() => {
          setFeedbackModalBooking(null);
          setFeedbackComment('');
          setFeedbackSuccessMsg('');
        }, 2000);
      } else {
        alert(data.error || 'Failed to submit review.');
      }
    } catch {
      alert('Network error while submitting review.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  useEffect(() => {
    let intervalId: any = null;

    const fetchCustomerData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login?redirect=/dashboard');
        return;
      }

      // Check role - if worker, redirect to worker dashboard
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (p?.role === 'worker') {
        router.replace('/worker-dashboard');
        return;
      }
      setProfile(p);

      const { data: j } = await supabase
        .from('jobs')
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });
      setJobs(j || []);

      const bRes = await globalThis.fetch('/api/bookings?role=customer');
      const bData = await bRes.json();
      const newBookings = bData.bookings || [];
      setBookings(newBookings);

      // Update selectedBooking in real-time if modal is open
      setSelectedBooking((prevSelected: any) => {
        if (!prevSelected) return null;
        const updated = newBookings.find((b: any) => b.id === prevSelected.id);
        return updated || prevSelected;
      });

      setLoading(false);
    };

    fetchCustomerData();
    intervalId = setInterval(fetchCustomerData, 10000);

    const handleBookingEvent = () => fetchCustomerData();
    window.addEventListener('fixitnow_booking_change', handleBookingEvent);

    return () => {
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener('fixitnow_booking_change', handleBookingEvent);
    };
  }, [router, supabase]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={`container ${styles.container}`}>
          <div className={styles.loadingState}><div className="spinner spinner-lg" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={`container ${styles.container}`}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <span className="section-tag">✦ Homeowner Portal</span>
            <h1 className={styles.greeting}>
              {t('dashboard.welcome').replace('{name}', profile?.full_name?.split(' ')[0] || 'there')}
            </h1>
            <p className={styles.subtext}>{t('dashboard.manage_requests')}</p>
          </div>
          <Link href="/upload" className="btn btn-primary">+ {t('dashboard.file_new_problem')}</Link>
        </div>

        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(79, 70, 229, 0.08)', color: 'var(--primary)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
            </div>
            <div className={styles.statMeta}>
              <div className={styles.statNum}>{jobs.length}</div>
              <div className={styles.statLbl}>{t('dashboard.total_issues')}</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(245, 158, 11, 0.08)', color: '#d97706' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
              </svg>
            </div>
            <div className={styles.statMeta}>
              <div className={styles.statNum}>{jobs.filter(j => j.status === 'pending' || j.status === 'assigned' || j.status === 'in_progress').length}</div>
              <div className={styles.statLbl}>{t('dashboard.active_repairs')}</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(16, 185, 129, 0.08)', color: 'var(--success)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
            <div className={styles.statMeta}>
              <div className={styles.statNum}>{bookings.length}</div>
              <div className={styles.statLbl}>{t('dashboard.bookings')}</div>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'jobs' ? styles.tabActive : ''}`} onClick={() => setTab('jobs')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            {t('dashboard.posted_issues')} ({jobs.length})
          </button>
          <button className={`${styles.tab} ${tab === 'bookings' ? styles.tabActive : ''}`} onClick={() => setTab('bookings')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            {t('dashboard.booking_requests')} ({bookings.length})
          </button>
        </div>

        {/* Content list */}
        {tab === 'jobs' ? (
          jobs.length > 0 ? (
            <div className={styles.list}>
              {jobs.map(j => {
                const trade = TRADE_CONFIG[(j.ai_trade_required as TradeType) || 'other'];
                return (
                  <Link key={j.id} href={`/results/${j.id}`} className={styles.jobCard}>
                    {j.media_url && (
                      <div className={styles.jobThumb}>
                        <img src={j.media_url} alt="" />
                      </div>
                    )}
                    <div className={styles.jobInfo}>
                      <div className={styles.jobTitle}>{j.ai_problem_title || 'Service Request'}</div>
                      <div className={styles.jobMeta}>
                        <span className={styles.tradeTag} style={{ background: trade.bg, color: trade.color }}>
                          {trade.emoji} {trade.label}
                        </span>
                        <span className={styles.jobDate}>
                          📅 {new Date(j.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                    <span className={`${styles.statusBadge} ${styles['status_' + j.status]}`}>
                      {j.status.replace('_', ' ')}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary, #4f46e5)', opacity: 0.85 }}>
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
              </div>
              <h3>{t('dashboard.no_issues')}</h3>
              <p>{t('dashboard.upload_photo')}</p>
              <Link href="/upload" className="btn btn-primary">{t('dashboard.file_problem')}</Link>
            </div>
          )
        ) : (
          bookings.length > 0 ? (
            <div className={styles.list}>
              {bookings.map(b => {
                const tradeObj = TRADE_CONFIG[(b.workers?.trade as TradeType) || 'other'];
                const workerName = b.workers?.profiles?.full_name || 'Pro Worker';
                const serviceTitle = b.jobs?.ai_problem_title || `${tradeObj ? tradeObj.label : 'Home'} Service`;
                const initials = workerName.split(' ').map((n: string) => n[0]).join('').toUpperCase();

                return (
                  <div key={b.id} className={styles.bookingCard} onClick={() => setSelectedBooking(b)} style={{ cursor: 'pointer' }}>
                    <div className={styles.bookingLeft}>
                      <div className={styles.bookingAvatar}>
                        {b.workers?.profiles?.avatar_url ? (
                          <img src={b.workers.profiles.avatar_url} alt="" />
                        ) : (
                          <div className={styles.bookingAvatarFb}>{initials}</div>
                        )}
                      </div>
                      <div className={styles.bookingInfo}>
                        <div className={styles.bookingWorker}>{workerName}</div>
                        <div className={styles.bookingJob}>{serviceTitle}</div>
                        <div className={styles.bookingDate}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '5px', color: 'var(--primary)' }}>
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                          {b.scheduled_at
                            ? (() => {
                                try {
                                  const d = new Date(b.scheduled_at);
                                  return isNaN(d.getTime()) ? 'Today, 10:00 AM' : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                                } catch { return 'Today, 10:00 AM'; }
                              })()
                            : 'Today, 10:00 AM'}
                        </div>
                      </div>
                    </div>
                    <div className={styles.bookingRight}>
                      {b.price_quoted && <div className={styles.bookingPrice}>₹{b.price_quoted}/hr</div>}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                        <span className={`${styles.statusBadge} ${styles['status_' + b.status]}`}>
                          {b.status.replace('_', ' ').toUpperCase()}
                        </span>
                        {b.status === 'completed' && (
                          reviewedBookingIds[b.id] ? (
                            <span className={styles.reviewedBadge}>★ Reviewed ({reviewedBookingIds[b.id]}/5)</span>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{ background: '#10b981', color: '#ffffff', borderRadius: '9999px', fontSize: '12px', padding: '5px 12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', border: 'none', cursor: 'pointer' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setFeedbackRating(5);
                                setFeedbackComment('');
                                setFeedbackSuccessMsg('');
                                setFeedbackModalBooking(b);
                              }}
                            >
                              ⭐ Rate &amp; Leave Feedback
                            </button>
                          )
                        )}
                        <button
                          type="button"
                          className="btn btn-primary btn-xs"
                          style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '9999px', display: 'inline-flex', alignItems: 'center' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (typeof window !== 'undefined') {
                              window.dispatchEvent(new CustomEvent('fixitnow_open_chat', {
                                detail: {
                                  bookingId: b.id,
                                  recipientName: b.worker_name || b.workers?.profiles?.full_name || 'Assigned Worker',
                                  recipientAvatar: b.workers?.profiles?.avatar_url,
                                  jobTitle: b.jobs?.ai_problem_title || 'Repair Service',
                                }
                              }));
                            }
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                          Chat with Worker
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary, #4f46e5)', opacity: 0.85 }}>
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                  <path d="M9 12h6" />
                  <path d="M9 16h6" />
                </svg>
              </div>
              <h3>{t('dashboard.no_bookings')}</h3>
              <p>{t('dashboard.book_worker')}</p>
            </div>
          )
        )}
      </div>

      {/* Booking Status Details Modal */}
      {selectedBooking && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedBooking(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalCloseBtn} onClick={() => setSelectedBooking(null)}>✕</button>

            <div className={styles.modalHeader}>
              <span className={styles.modalTag}>✦ Booking Details</span>
              <h2 className={styles.modalTitle}>Request Status</h2>
            </div>

            <div className={styles.modalWorkerRow}>
              <div className={styles.modalAvatar}>
                {selectedBooking.workers?.profiles?.avatar_url ? (
                  <img src={selectedBooking.workers.profiles.avatar_url} alt="" />
                ) : (
                  <div className={styles.modalAvatarFb}>
                    {(selectedBooking.workers?.profiles?.full_name || 'Worker').split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                  </div>
                )}
              </div>
              <div className={styles.modalWorkerInfo}>
                <div className={styles.modalWorkerName}>{selectedBooking.workers?.profiles?.full_name || 'Pro Worker'}</div>
                <div className={styles.modalServiceTitle}>
                  {selectedBooking.jobs?.ai_problem_title || `${selectedBooking.workers?.trade ? selectedBooking.workers.trade.toUpperCase() : 'HOME'} SERVICE`}
                </div>
              </div>
              {selectedBooking.price_quoted && (
                <div className={styles.modalPrice}>
                  ₹{selectedBooking.price_quoted}<span>/hr</span>
                </div>
              )}
            </div>

            {/* Stepper Status Tracker */}
            <div className={styles.modalTracker}>
              <div className={`${styles.modalStep} ${styles.stepDone}`}>
                <div className={styles.stepDot}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <span className={styles.stepLabel}>Requested</span>
              </div>
              <div className={`${styles.stepLine} ${styles.lineActive}`} />

              <div className={`${styles.modalStep} ${selectedBooking.status === 'accepted' || selectedBooking.status === 'in_progress' || selectedBooking.status === 'completed' ? styles.stepDone : styles.stepCurrent}`}>
                <div className={styles.stepDot}>{selectedBooking.status === 'requested' ? '2' : '✓'}</div>
                <span className={styles.stepLabel}>Notified</span>
              </div>
              <div className={`${styles.stepLine} ${selectedBooking.status === 'accepted' || selectedBooking.status === 'in_progress' || selectedBooking.status === 'completed' ? styles.lineActive : ''}`} />

              <div className={`${styles.modalStep} ${selectedBooking.status === 'accepted' || selectedBooking.status === 'in_progress' || selectedBooking.status === 'completed' ? styles.stepDone : ''}`}>
                <div className={styles.stepDot}>3</div>
                <span className={styles.stepLabel}>Accepted</span>
              </div>
              <div className={`${styles.stepLine} ${selectedBooking.status === 'completed' ? styles.lineActive : ''}`} />

              <div className={`${styles.modalStep} ${selectedBooking.status === 'completed' ? styles.stepDone : ''}`}>
                <div className={styles.stepDot}>4</div>
                <span className={styles.stepLabel}>Completed</span>
              </div>
            </div>

            <div className={styles.modalMetaGrid}>
              <div className={styles.modalMetaItem}>
                <span className={styles.metaItemLabel}>Scheduled Time</span>
                <span className={styles.metaItemVal}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '4px', color: 'var(--primary)' }}>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  {selectedBooking.scheduled_at
                    ? (() => {
                        try {
                          const d = new Date(selectedBooking.scheduled_at);
                          return isNaN(d.getTime()) ? 'Today, 10:00 AM' : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                        } catch { return 'Today, 10:00 AM'; }
                      })()
                    : 'Today, 10:00 AM'}
                </span>
              </div>
              <div className={styles.modalMetaItem}>
                <span className={styles.metaItemLabel}>Current Status</span>
                <span className={styles.modalStatusPill}>
                  ⚡ {selectedBooking.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              {selectedBooking.notes && (
                <div className={styles.modalMetaItem} style={{ gridColumn: '1 / -1', borderTop: '1px solid #e2e8f0', paddingTop: '8px', marginTop: '4px' }}>
                  <span className={styles.metaItemLabel}>Issue Description</span>
                  <span className={styles.metaItemVal} style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    &ldquo;{selectedBooking.notes}&rdquo;
                  </span>
                </div>
              )}
            </div>

            {/* Inline Feedback Form inside Booking Details Modal if Job is Completed */}
            {selectedBooking.status === 'completed' && (
              <div className={styles.feedbackSection}>
                <div className={styles.feedbackTitle}>
                  <span>⭐</span> Share Service Feedback &amp; Rating
                </div>

                {reviewedBookingIds[selectedBooking.id] ? (
                  <div style={{ color: '#166534', fontSize: '13px', fontWeight: 700, background: '#dcfce7', padding: '10px 14px', borderRadius: '12px' }}>
                    ✓ Feedback submitted! Rating: ★ {reviewedBookingIds[selectedBooking.id]}/5 stars. Thank you for your review!
                  </div>
                ) : (
                  <>
                    <div className={styles.starPickerRow}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginRight: '8px' }}>Rating:</span>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          className={styles.starPickerBtn}
                          onClick={() => setFeedbackRating(star)}
                        >
                          <svg width="22" height="22" viewBox="0 0 24 24" fill={star <= feedbackRating ? '#fbbf24' : '#e2e8f0'} stroke={star <= feedbackRating ? '#f59e0b' : '#cbd5e1'} strokeWidth="1.5">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        </button>
                      ))}
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#b45309', marginLeft: '6px' }}>{feedbackRating} / 5 Stars</span>
                    </div>

                    <textarea
                      className={styles.feedbackTextarea}
                      placeholder="Write your review... (e.g. Arrived on time, fixed the leak efficiently, polite behavior)"
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                    />

                    {feedbackSuccessMsg && (
                      <div style={{ color: '#166534', fontSize: '13px', fontWeight: 700 }}>
                        {feedbackSuccessMsg}
                      </div>
                    )}

                    <button
                      type="button"
                      className={styles.submitFeedbackBtn}
                      disabled={feedbackSubmitting}
                      onClick={() => handleFeedbackSubmit(selectedBooking)}
                    >
                      {feedbackSubmitting ? 'Submitting...' : 'Submit Verified Feedback'}
                    </button>
                  </>
                )}
              </div>
            )}

            <div className={styles.modalFooter} style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1, borderRadius: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={() => {
                  const b = selectedBooking;
                  setSelectedBooking(null);
                  if (typeof window !== 'undefined' && b) {
                    window.dispatchEvent(new CustomEvent('fixitnow_open_chat', {
                      detail: {
                        bookingId: b.id,
                        recipientName: b.worker_name || b.workers?.profiles?.full_name || 'Assigned Worker',
                        recipientAvatar: b.workers?.profiles?.avatar_url,
                        jobTitle: b.jobs?.ai_problem_title || 'Repair Service',
                      }
                    }));
                  }
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Message Worker
              </button>
              <button className="btn btn-secondary" style={{ borderRadius: '12px' }} onClick={() => setSelectedBooking(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standalone Leave Feedback Modal Dialog */}
      {feedbackModalBooking && (
        <div className={styles.modalBackdrop} onClick={() => setFeedbackModalBooking(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <button className={styles.modalCloseBtn} onClick={() => setFeedbackModalBooking(null)}>✕</button>

            <div className={styles.modalHeader}>
              <span className={styles.modalTag}>✦ Customer Review</span>
              <h2 className={styles.modalTitle}>Rate Your Repair Experience</h2>
            </div>

            <div className={styles.modalWorkerRow}>
              <div className={styles.modalAvatar}>
                {feedbackModalBooking.workers?.profiles?.avatar_url ? (
                  <img src={feedbackModalBooking.workers.profiles.avatar_url} alt="" />
                ) : (
                  <div className={styles.modalAvatarFb}>
                    {(feedbackModalBooking.workers?.profiles?.full_name || 'Worker').split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                  </div>
                )}
              </div>
              <div className={styles.modalWorkerInfo}>
                <div className={styles.modalWorkerName}>{feedbackModalBooking.workers?.profiles?.full_name || 'Pro Worker'}</div>
                <div className={styles.modalServiceTitle}>
                  {feedbackModalBooking.jobs?.ai_problem_title || 'Repair Service'}
                </div>
              </div>
            </div>

            <div className={styles.feedbackSection} style={{ marginTop: '0' }}>
              <div className={styles.starPickerRow}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#374151', marginRight: '8px' }}>Rating:</span>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={styles.starPickerBtn}
                    onClick={() => setFeedbackRating(star)}
                  >
                    <svg width="26" height="26" viewBox="0 0 24 24" fill={star <= feedbackRating ? '#fbbf24' : '#e2e8f0'} stroke={star <= feedbackRating ? '#f59e0b' : '#cbd5e1'} strokeWidth="1.5">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </button>
                ))}
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#b45309', marginLeft: '8px' }}>{feedbackRating} / 5 Stars</span>
              </div>

              <textarea
                className={styles.feedbackTextarea}
                placeholder="Share your experience... (e.g. Great communication, clean work, highly recommended!)"
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                style={{ minHeight: '90px' }}
              />

              {feedbackSuccessMsg && (
                <div style={{ color: '#166534', fontSize: '13px', fontWeight: 700, background: '#dcfce7', padding: '10px 14px', borderRadius: '12px' }}>
                  {feedbackSuccessMsg}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  className={styles.submitFeedbackBtn}
                  style={{ flex: 1 }}
                  disabled={feedbackSubmitting}
                  onClick={() => handleFeedbackSubmit(feedbackModalBooking)}
                >
                  {feedbackSubmitting ? 'Saving Feedback...' : '⭐ Submit Verified Feedback'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ borderRadius: '12px' }}
                  onClick={() => setFeedbackModalBooking(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
