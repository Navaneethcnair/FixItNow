'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './home.module.css';
import { TRADE_CONFIG, TradeType } from '@/lib/types';
import { useLanguage } from '@/context/LanguageContext';

const TRADES: TradeType[] = ['plumber', 'electrician', 'carpenter', 'painter', 'ac_tech', 'welder', 'mason', 'other'];

const HOW_IT_WORKS = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
    title: 'Upload Photo or Video',
    desc: 'Take a photo or short video of the problem — pipe crack, broken socket, anything.',
    color: 'var(--primary)',
    bgColor: 'var(--primary-bg)',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
        <rect x="9" y="9" width="6" height="6" />
        <line x1="9" y1="1" x2="9" y2="4" />
        <line x1="15" y1="1" x2="15" y2="4" />
        <line x1="9" y1="20" x2="9" y2="23" />
        <line x1="15" y1="20" x2="15" y2="23" />
        <line x1="20" y1="9" x2="23" y2="9" />
        <line x1="20" y1="15" x2="23" y2="15" />
        <line x1="1" y1="9" x2="4" y2="9" />
        <line x1="1" y1="15" x2="4" y2="15" />
      </svg>
    ),
    title: 'AI Detects the Issue',
    desc: 'Our AI engine identifies the problem, estimates dimensions, and classifies the trade needed.',
    color: 'var(--accent)',
    bgColor: 'var(--accent-bg)',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: 'Worker is Dispatched',
    desc: 'The right professional near you is matched and notified. Book in one tap.',
    color: 'var(--success)',
    bgColor: 'var(--success-bg)',
  },
];

const STATS = [
  { value: '10,000+', label: 'Jobs Completed' },
  { value: '2,500+', label: 'Verified Workers' },
  { value: '98%', label: 'Satisfaction Rate' },
  { value: '<30 min', label: 'Avg. Response Time' },
];

const TESTIMONIALS = [
  { name: 'Priya Mehta', city: 'Mumbai', rating: 5, text: 'Uploaded a photo of my leaking pipe and within minutes a plumber was at my door. Incredible service!', trade: 'plumber' },
  { name: 'Arjun Singh', city: 'Delhi', rating: 5, text: 'The AI correctly identified my electrical problem and sent a certified electrician. Very impressed.', trade: 'electrician' },
  { name: 'Sunita Rao', city: 'Bengaluru', rating: 5, text: 'Fixed my broken door in 2 hours. The carpenter was professional and the price was fair.', trade: 'carpenter' },
];

export default function HomePage() {
  const { t } = useLanguage();
  const [locationName, setLocationName] = useState('Detecting location...');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkUserRole = async () => {
      // 1. Check Supabase User
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
          if (p?.role === 'worker') {
            router.replace('/worker-dashboard');
            return;
          }
        }
      } catch (e) {
        console.error('Error checking user session role:', e);
      }

      // 2. Fallback to LocalStorage check
      if (typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem('fixitnow_user');
          if (raw) {
            const u = JSON.parse(raw);
            const role = u.user_metadata?.role || u.role;
            if (role === 'worker') {
              router.replace('/worker-dashboard');
            }
          }
        } catch {}
      }
    };
    checkUserRole();

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`
            );
            const data = await res.json();
            const locality = data.address?.suburb || data.address?.city_district || data.address?.city || 'Your Location';
            setLocationName(locality);
          } catch {
            setLocationName('Your Location');
          }
        },
        () => setLocationName('Enable location')
      );
    } else {
      setLocationName('Location unavailable');
    }
  }, [router, supabase]);

  return (
    <div className={styles.page}>
      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.locationPill}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {locationName === 'Detecting location...' ? t('home.detecting_location') : locationName}
          </div>

          <h1 className={styles.heroTitle}>
            {t('home.hero_title').split(',')[0]},<br />
            <span className="gradient-text">{t('home.hero_title').split(',')[1]}</span>
          </h1>
          <p className={styles.heroSubtitle}>
            {t('home.hero_subtitle')}
          </p>
          <div className={styles.heroCta}>
            <Link href="/upload" className="btn btn-primary btn-lg" style={{ display: 'inline-flex', alignItems: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '8px' }}>
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              {t('home.upload_problem')}
            </Link>
            <Link href="/workers" className="btn btn-secondary btn-lg">
              {t('dock.browse_workers')}
            </Link>
          </div>

          <div className={styles.heroStats}>
            {STATS.map(s => (
              <div key={s.label} className={styles.heroStat}>
                <div className={styles.heroStatVal}>{s.value}</div>
                <div className={styles.heroStatLbl}>{t('home.stat_' + s.label.toLowerCase().replace(/[^a-z]/g, '_'))}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className={styles.section}>
        <div className="container">
          <div className={styles.sectionHead}>
            <span className="section-tag">✦ {t('home.services_tag')}</span>
            <h2 className="section-title">{t('home.services_title')}</h2>
            <p className="section-subtitle">{t('home.services_subtitle')}</p>
          </div>
          <div className={styles.categoryGrid}>
            {TRADES.map(trade => {
              const cfg = TRADE_CONFIG[trade];
              return (
                <Link
                  key={trade}
                  href={`/workers?trade=${trade}`}
                  className={styles.categoryCard}
                  style={{ '--trade-color': cfg.color, '--trade-bg': cfg.bg } as React.CSSProperties}
                >
                  <div className={styles.categoryIcon}>{cfg.emoji}</div>
                  <div className={styles.categoryLabel}>{t(`trade.${trade}`)}</div>
                  <div className={styles.categoryArrow}>→</div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className="container">
          <div className={styles.sectionHead}>
            <span className="section-tag">✦ {t('home.how_it_works_tag')}</span>
            <h2 className="section-title">{t('home.how_it_works_title')}</h2>
          </div>
          <div className={styles.howGrid}>
            {HOW_IT_WORKS.map((step, i) => (
              <div key={i} className={styles.howCard}>
                <div className={styles.howNumber}>{String(i + 1).padStart(2, '0')}</div>
                <div className={styles.howIconWrap} style={{ '--step-color': step.color, '--step-bg': step.bgColor } as React.CSSProperties}>
                  {step.icon}
                </div>
                <h3 className={styles.howTitle}>{t(`home.step${i + 1}_title`)}</h3>
                <p className={styles.howDesc}>{t(`home.step${i + 1}_desc`)}</p>
              </div>
            ))}
          </div>

          <div className={styles.howCta}>
            <Link href="/upload" className="btn btn-primary btn-lg">
              {t('home.try_it_free')}
            </Link>
          </div>
        </div>
      </section>

      {/* AI HIGHLIGHT */}
      <section className={styles.section}>
        <div className="container">
          <div className={styles.aiHighlight}>
            <div className={styles.aiLeft}>
              <span className="section-tag">✦ {t('home.ai_powered_tag')}</span>
              <h2 className="section-title">{t('home.ai_title').split('.')[0]}.<br />{t('home.ai_title').split('.')[1]}</h2>
              <p className="section-subtitle">
                {t('home.ai_subtitle')}
              </p>
              <ul className={styles.aiFeatures}>
                {[
                  {
                    key: 'home.ai_feature_1',
                    svg: (
                      // Magnifying glass with sparkle — "identifies problems"
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="7" />
                        <line x1="16.5" y1="16.5" x2="22" y2="22" />
                        <line x1="11" y1="8" x2="11" y2="8.01" strokeWidth="2.5" />
                        <path d="M9 11h2l1 3" />
                      </svg>
                    ),
                  },
                  {
                    key: 'home.ai_feature_2',
                    svg: (
                      // Ruler — "estimates size/length/area"
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="7" width="20" height="10" rx="2" />
                        <line x1="6" y1="11" x2="6" y2="13" />
                        <line x1="10" y1="11" x2="10" y2="14" />
                        <line x1="14" y1="11" x2="14" y2="13" />
                        <line x1="18" y1="11" x2="18" y2="14" />
                      </svg>
                    ),
                  },
                  {
                    key: 'home.ai_feature_3',
                    svg: (
                      // Lightning bolt in shield — "urgency level"
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2L4 6v6c0 5.25 3.5 9.74 8 11 4.5-1.26 8-5.75 8-11V6l-8-4z" />
                        <polyline points="13 9 10 13 14 13 11 17" />
                      </svg>
                    ),
                  },
                  {
                    key: 'home.ai_feature_4',
                    svg: (
                      // Person with location pin — "matches to nearest professional"
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M19 8c0 3-3 5-3 5s-3-2-3-5a3 3 0 0 1 6 0z" />
                        <circle cx="19" cy="8" r="1" fill="currentColor" stroke="none" />
                      </svg>
                    ),
                  },
                ].map((f, i) => (
                  <li key={i} className={styles.aiFeature}>
                    <div className={styles.aiFeatureIcon}>{f.svg}</div>
                    <div className={styles.aiFeatureText}>{t(f.key)}</div>
                  </li>
                ))}
              </ul>
              <Link href="/upload" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>{t('home.upload_cta')}</Link>
            </div>
            <div className={styles.aiRight}>
              <div className={styles.aiDemo}>
                <div className={styles.aiDemoScreen}>
                  <div className={styles.aiDemoImgContainer}>
                    <div className={styles.aiDemoImg}>
                      <span className={styles.aiDemoImgIcon}>💧</span>
                      <span>{t('demo.pipe_detected')}</span>
                    </div>
                    <div className={styles.aiScannerLine} />
                  </div>
                  <div className={styles.aiDemoResult}>
                    <div className={styles.aiDemoTag} style={{ background: '#e0f2fe', color: '#0284c7' }}>🔧 {t('trade.plumber')} {t('demo.required')}</div>
                    <div className={styles.aiDemoLine}>
                      <span>{t('demo.problem_lbl')}</span>
                      <strong>{t('demo.problem_val')}</strong>
                    </div>
                    <div className={styles.aiDemoLine}>
                      <span>{t('demo.dimension_lbl')}</span>
                      <strong>{t('demo.dimension_val')}</strong>
                    </div>
                    <div className={styles.aiDemoLine}>
                      <span>{t('demo.severity_lbl')}</span>
                      <strong style={{ color: '#f43f5e' }}>{t('demo.urgent')}</strong>
                    </div>
                    <div className={styles.aiDemoLine}>
                      <span>{t('demo.confidence_lbl')}</span>
                      <strong>92%</strong>
                    </div>
                  </div>
                  <div className={styles.aiDemoWorkers}>
                    <span>{t('demo.plumbers_available')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className="container">
          <div className={styles.sectionHead}>
            <span className="section-tag">✦ {t('demo.reviews_tag')}</span>
            <h2 className="section-title">{t('demo.reviews_title')}</h2>
          </div>
          <div className={styles.testimonialGrid}>
            {TESTIMONIALS.map((tItem, i) => (
              <div key={i} className={styles.testimonialCard}>
                <div className={styles.testimonialStars}>{'⭐'.repeat(tItem.rating)}</div>
                <p className={styles.testimonialText}>&ldquo;{tItem.text}&rdquo;</p>
                <div className={styles.testimonialAuthor}>
                  <div className={styles.testimonialAvatar}>{tItem.name[0]}</div>
                  <div>
                    <div className={styles.testimonialName}>{tItem.name}</div>
                    <div className={styles.testimonialCity}>📍 {tItem.city}</div>
                  </div>
                  <div
                    className={styles.testimonialTrade}
                    style={{
                      background: TRADE_CONFIG[tItem.trade as TradeType].bg,
                      color: TRADE_CONFIG[tItem.trade as TradeType].color,
                    }}
                  >
                    {TRADE_CONFIG[tItem.trade as TradeType].emoji}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.curveDivider}>
          <svg data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" fill="currentColor"></path>
          </svg>
        </div>
        <div className="container">
          <h2 className={styles.finalTitle}>{t('home.final_title')}</h2>
          <p className={styles.finalSubtitle}>{t('home.final_subtitle')}</p>
          <Link href="/upload" className="btn btn-primary btn-lg" style={{ display: 'inline-flex', alignItems: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '8px' }}>
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            {t('home.upload_free')}
          </Link>
        </div>
      </section>
    </div>
  );
}
