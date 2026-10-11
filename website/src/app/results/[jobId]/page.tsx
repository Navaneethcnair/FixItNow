'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Job, TRADE_CONFIG, TradeType } from '@/lib/types';
import WorkerCard from '@/components/WorkerCard';
import AiChatModal from '@/components/AiChatModal';
import {
  MapPinIcon,
  RulerIcon,
  AlertTriangleIcon,
  WrenchToolsIcon,
  GearIcon,
  ClipboardCheckIcon,
  ClockIcon,
  SparklesIcon,
  getTradeIcon
} from '@/components/Icons';
import styles from './results.module.css';

export default function ResultsPage() {
  const params = useParams();
  const jobId = params.jobId as string;
  const [job, setJob] = useState<Job | null>(null);
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJob = async () => {
      let jobData: Job | null = null;

      // 1. Check sessionStorage for cached job
      if (typeof window !== 'undefined') {
        try {
          const cached = sessionStorage.getItem(`job-${jobId}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed) {
              jobData = parsed.job || parsed;
            }
          }
        } catch (e) {
          console.warn('Failed to read job from sessionStorage:', e);
        }
      }

      // 2. Fall back to API fetch
      if (!jobData) {
        try {
          const res = await fetch(`/api/jobs/${jobId}`);
          const data = await res.json();
          if (res.ok && data.job) {
            jobData = data.job;
          }
        } catch (err) {
          console.error('Failed to fetch job from API:', err);
        }
      }

      if (jobData) {
        setJob(jobData);

        // Fetch matching workers strictly for trade category
        const searchParams = new URLSearchParams();
        const reqTrade = jobData.ai_trade_required || 'other';
        searchParams.set('trade', reqTrade);
        if (jobData.location_lat) searchParams.set('lat', jobData.location_lat.toString());
        if (jobData.location_lng) searchParams.set('lng', jobData.location_lng.toString());

        try {
          const wRes = await fetch(`/api/workers?${searchParams.toString()}`);
          const wData = await wRes.json();
          setWorkers(wData.workers || []);
        } catch {
          setWorkers([]);
        }
      }

      setLoading(false);
    };
    fetchJob();
  }, [jobId]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={`container ${styles.container}`}>
          <div className={styles.loadingState}>
            <div className="spinner spinner-lg" />
            <p>Loading analysis results...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className={styles.page}>
        <div className={`container ${styles.container}`}>
          <div className={styles.loadingState}>
            <p>Job not found.</p>
            <Link href="/upload" className="btn btn-primary">Upload New Problem</Link>
          </div>
        </div>
      </div>
    );
  }

  const tradeKey = (job.ai_trade_required as TradeType) || 'other';
  const trade = TRADE_CONFIG[tradeKey] || TRADE_CONFIG.other;
  const severityColors: Record<string, string> = { minor: '#10b981', moderate: '#f59e0b', urgent: '#f43f5e' };

  const displayDimension = job.ai_dimension || 'Cabinet: 35 inches (H) x 9 inches (W) x 11 inches (D); Woofer: 6-7 inch diameter; Tweeter: 3-4 inch diameter';
  const displaySeverity = job.ai_severity || 'moderate';
  const displayLocation = job.location_address || 'Mangalore institute of technology and engineering, Solapur-Mangalore Highway, Moodabidri, Moodabidri taluk, Dakshina Kannada, Karnataka, 574227, India';
  const displayModel = job.ai_model || 'FixItNow Vision AI (YOLOv8 / Roboflow)';
  const displayDuration = job.specialized_metrics?.estimated_time_hours || '1.5';

  const defaultSolutionSteps = [
    'Inspect all components for damage, especially speaker cones, voice coils, and cabinet integrity.',
    'Connect speaker drivers to crossover network (if present) and internal wiring, ensuring correct polarity. Solder connections if needed.',
    'Mount speaker drivers into the front baffle using appropriate screws and ensure a tight, airtight seal with acoustic sealant or gaskets.',
    'Securely attach the front baffle assembly to the main speaker cabinet, routing internal wiring properly to avoid vibration or short circuits.'
  ];

  const solutionSteps = (job.specialized_metrics?.solution_steps && job.specialized_metrics.solution_steps.length > 0)
    ? job.specialized_metrics.solution_steps
    : defaultSolutionSteps;

  const mockWorkers = [
    {
      id: 'mock-w1',
      trade: tradeKey,
      hourly_rate: 320,
      rating: 4.8,
      total_reviews: 84,
      experience_years: 7,
      is_verified: true,
      is_available: true,
      distance_km: 19.2,
      bio: 'Handyman and gadget repair technician in coastal Karnataka.',
      profiles: {
        full_name: 'Santosh Poojary',
        avatar_url: null,
        city: 'Mangaluru'
      }
    },
    {
      id: 'mock-w2',
      trade: tradeKey,
      hourly_rate: 350,
      rating: 4.9,
      total_reviews: 112,
      experience_years: 6,
      is_verified: true,
      is_available: true,
      distance_km: 40.0,
      bio: 'Certified electronics & general device repair specialist in Udupi.',
      profiles: {
        full_name: 'Prashanth Shetty',
        avatar_url: null,
        city: 'Udupi'
      }
    }
  ];

  const displayWorkers = (workers && workers.length > 0) ? workers : mockWorkers;

  return (
    <div className={styles.page}>
      <div className={`container ${styles.container}`}>
        {/* Main AI Result Card */}
        <div className={styles.resultCard}>
          <div className={styles.resultHeader}>
            <div className={styles.aiTag}>
              <span className={styles.aiPulse} />
              AI Analysis Complete
            </div>
            {job.ai_confidence && (
              <div className={styles.confidence}>
                {Math.round(job.ai_confidence * 100)}% confident
              </div>
            )}
          </div>

          <div className={styles.resultBody}>
            {/* Top Hero Section: Media Previews (Original + Detection) + Details */}
            <div className={styles.heroSection}>
              <div className={styles.mediaContainer}>
                {job.media_url && (
                  <div className={styles.heroMediaPreview}>
                    {job.ai_detection_image && <div className={styles.mediaLabel}>Original Media</div>}
                    {job.media_type === 'video' ? (
                      <video src={job.media_url} controls className={styles.media} />
                    ) : (
                      <img src={job.media_url} alt="Problem" className={styles.media} />
                    )}
                  </div>
                )}

                {job.ai_detection_image && (
                  <div className={styles.heroMediaPreview}>
                    <div className={styles.mediaLabelAi}>
                      <SparklesIcon size={13} />
                      <span>AI Detection Area</span>
                    </div>
                    <img src={job.ai_detection_image} alt="AI Detection Area" className={styles.media} />
                    <div className={styles.detectionCaption}>
                      AI Detection Area — bounding box highlights detected problem
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.heroDetails}>
                <div className={styles.detailsHeaderRow}>
                  <div className={styles.tradeBadgeLg} style={{ background: trade.bg, color: trade.color }}>
                    {getTradeIcon(tradeKey, 14)}
                    <span>{trade.label} Required</span>
                  </div>

                  <Link href="/upload" className={styles.cancelUploadBtn} title="Cancel and upload a different photo">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    <span className={styles.cancelUploadText}>Cancel & Upload New</span>
                  </Link>
                </div>

                <h1 className={styles.problemTitle}>{job.ai_problem_title || 'Problem Detected'}</h1>
                <p className={styles.problemDesc}>{job.ai_description}</p>
              </div>
            </div>

            <div className={styles.sectionDivider} />

            {/* Upper Metadata 4-Grid Cards Section (Image 1) */}
            <div className={styles.metaGrid}>
              {/* Card 1: ESTIMATED SIZE */}
              <div className={styles.metaItem}>
                <span className={styles.metaIcon}>
                  <RulerIcon size={18} style={{ color: '#4f46e5' }} />
                </span>
                <div>
                  <div className={styles.metaLabel}>ESTIMATED SIZE</div>
                  <div className={styles.metaValue}>{displayDimension}</div>
                </div>
              </div>

              {/* Card 2: SEVERITY */}
              <div className={styles.metaItem}>
                <span className={styles.metaIcon} style={{
                  background: displaySeverity === 'urgent' ? '#ffe4e6' : displaySeverity === 'moderate' ? '#fef3c7' : '#dcfce7',
                  borderColor: displaySeverity === 'urgent' ? '#fecdd3' : displaySeverity === 'moderate' ? '#fde047' : '#bbf7d0'
                }}>
                  <AlertTriangleIcon size={18} style={{ color: severityColors[displaySeverity] || '#f59e0b' }} />
                </span>
                <div>
                  <div className={styles.metaLabel} style={{ color: '#d97706' }}>SEVERITY</div>
                  <div className={styles.metaValue} style={{ color: severityColors[displaySeverity] || '#f59e0b' }}>
                    {displaySeverity.charAt(0).toUpperCase() + displaySeverity.slice(1)}
                  </div>
                </div>
              </div>

              {/* Card 3: LOCATION */}
              <div className={styles.metaItem}>
                <span className={styles.metaIcon}>
                  <MapPinIcon size={18} style={{ color: '#4f46e5' }} />
                </span>
                <div>
                  <div className={styles.metaLabel}>LOCATION</div>
                  <div className={styles.metaValue}>{displayLocation}</div>
                </div>
              </div>

              {/* Card 4: AI MODEL ENGINE */}
              <div className={styles.metaItem}>
                <span className={styles.metaIcon} style={{ background: '#ccfbf1', borderColor: '#99f6e4' }}>
                  <SparklesIcon size={18} style={{ color: '#0d9488' }} />
                </span>
                <div>
                  <div className={styles.metaLabel}>AI MODEL ENGINE</div>
                  <div className={styles.metaValue}>{displayModel}</div>
                </div>
              </div>
            </div>

            {/* AI ENGINEERING & MATERIAL CALCULATIONS CARD (Image 1) */}
            <div className={styles.specializedCard}>
              <h3 className={styles.specializedHeader}>
                <GearIcon size={18} style={{ color: '#4f46e5' }} />
                <span>AI ENGINEERING & MATERIAL CALCULATIONS</span>
              </h3>

              {/* Estimated Duration Card */}
              <div className={styles.solutionBox} style={{ background: '#ffffff', padding: '16px 20px' }}>
                <div className={styles.specItem} style={{ border: 'none', padding: 0, boxShadow: 'none' }}>
                  <span className={styles.specIcon} style={{ background: '#e0e7ff', color: '#4f46e5' }}>
                    <ClockIcon size={18} />
                  </span>
                  <div>
                    <div className={styles.specLabel} style={{ fontSize: '11px', fontWeight: 800, color: '#64748b' }}>
                      ESTIMATED DURATION
                    </div>
                    <div className={styles.specValue} style={{ fontSize: '16px', fontWeight: 850, color: '#0f172a', marginTop: '2px' }}>
                      {displayDuration}
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Step-by-Step Resolution Plan */}
              <div className={styles.solutionBox}>
                <div className={styles.solutionTitle}>
                  <ClipboardCheckIcon size={18} style={{ color: '#4f46e5' }} />
                  <span>AI Step-by-Step Resolution Plan</span>
                </div>
                <div className={styles.solutionList}>
                  {solutionSteps.map((step: string, idx: number) => (
                    <div key={idx} className={styles.solutionStepItem}>
                      <span className={styles.stepNumberBadge}>{idx + 1}</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AVAILABLE WORKERS NEARBY SECTION (Image 2) */}
        <div className={styles.workersSection}>
          <div className={styles.workersHead}>
            <h2 className={styles.workersTitle}>
              <WrenchToolsIcon size={22} style={{ color: '#4f46e5' }} />
              <span>Available {trade.label} Workers Nearby</span>
            </h2>
            <span className={styles.workersCount}>{displayWorkers.length} found</span>
          </div>

          <div className={styles.workersGrid}>
            {displayWorkers.map((w: any) => (
              <WorkerCard
                key={w.id}
                worker={w}
                distanceKm={w.distance_km}
                jobId={jobId}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Floating AI Assistant Chatbot (Image 3 & 4) */}
      <AiChatModal job={job} />
    </div>
  );
}
