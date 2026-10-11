'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  SparklesIcon,
  MapPinIcon,
  WrenchIcon,
  CheckBadgeIcon,
} from '@/components/Icons';
import styles from './SidebarDock.module.css';
import { useLanguage } from '@/context/LanguageContext';

// SVG Icons (Medium 20px)
function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function ActiveLightningIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function WorkersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  );
}

export default function SidebarDock() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTabParam = searchParams.get('tab');

  const [role, setRole] = useState<'customer' | 'worker' | 'guest'>('guest');

  useEffect(() => {
    const updateSession = () => {
      if (typeof window === 'undefined') return;
      try {
        const raw = window.localStorage.getItem('fixitnow_user');
        if (raw) {
          const user = JSON.parse(raw);
          setRole(user.user_metadata?.role || user.role || 'customer');
        } else {
          setRole('guest');
        }
      } catch {
        setRole('guest');
      }
    };

    updateSession();
    window.addEventListener('fixitnow_auth_change', updateSession);
    window.addEventListener('storage', updateSession);
    return () => {
      window.removeEventListener('fixitnow_auth_change', updateSession);
      window.removeEventListener('storage', updateSession);
    };
  }, []);

  const isWorker = role === 'worker';
  const activeClass = isWorker ? styles.dockItemActiveWorker : styles.dockItemActive;

  const scrollToJobs = () => {
    setTimeout(() => {
      const el = document.getElementById('jobs-control');
      if (el) {
        const y = el.getBoundingClientRect().top + window.pageYOffset - 95;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }
    }, 60);
  };

  return (
    <aside className={styles.dockWrapper} aria-label="Sidebar navigation dock">
      <div className={styles.dockContainer}>
        <div className={styles.dockHeader}>
          <span className={styles.dockHeaderTitle}>
            {isWorker ? t('dock.console') : role === 'customer' ? t('dock.main_menu') : 'FixItNow'}
          </span>
        </div>

        {/* ── WORKER ROLE NAVIGATION ───────────────────────────── */}
        {isWorker ? (
          <>
            {/* 1. Worker Console Home */}
            <Link
              href="/worker-dashboard"
              className={`${styles.dockItem} ${pathname === '/worker-dashboard' && !activeTabParam ? activeClass : ''}`}
            >
              <div className={styles.itemIconContainer}>
                <DashboardIcon />
              </div>
              <span className={styles.itemLabel}>{t('dock.worker_console')}</span>
              <span className={styles.tooltip}>{t('dock.worker_console')}</span>
            </Link>

            {/* 2. Incoming Requests */}
            <Link
              href="/worker-dashboard?tab=requests"
              className={`${styles.dockItem} ${pathname === '/worker-dashboard' && activeTabParam === 'requests' ? activeClass : ''}`}
              onClick={scrollToJobs}
            >
              <div className={styles.itemIconContainer}>
                <InboxIcon />
              </div>
              <span className={styles.itemLabel}>{t('dock.incoming_requests')}</span>
              <span className={styles.tooltip}>{t('dock.incoming_requests')}</span>
            </Link>

            {/* 3. Active Jobs */}
            <Link
              href="/worker-dashboard?tab=active"
              className={`${styles.dockItem} ${pathname === '/worker-dashboard' && activeTabParam === 'active' ? activeClass : ''}`}
              onClick={scrollToJobs}
            >
              <div className={styles.itemIconContainer}>
                <ActiveLightningIcon />
              </div>
              <span className={styles.itemLabel}>{t('dock.active_jobs')}</span>
              <span className={styles.tooltip}>{t('dock.active_jobs')}</span>
            </Link>

            {/* 4. Completed History */}
            <Link
              href="/worker-dashboard?tab=history"
              className={`${styles.dockItem} ${pathname === '/worker-dashboard' && activeTabParam === 'history' ? activeClass : ''}`}
              onClick={scrollToJobs}
            >
              <div className={styles.itemIconContainer}>
                <CheckBadgeIcon size={20} />
              </div>
              <span className={styles.itemLabel}>{t('dock.completed_history')}</span>
              <span className={styles.tooltip}>{t('dock.completed_history')}</span>
            </Link>

            <div className={styles.dockDivider} />

            {/* 5. Location & Service Area */}
            <Link
              href="/profile?tab=location"
              className={`${styles.dockItem} ${pathname === '/profile' && activeTabParam === 'location' ? activeClass : ''}`}
            >
              <div className={styles.itemIconContainer}>
                <MapPinIcon size={20} />
              </div>
              <span className={styles.itemLabel}>{t('dock.location_radius')}</span>
              <span className={styles.tooltip}>{t('dock.location_radius')}</span>
            </Link>

            {/* 6. Trade Specialty & Service Profile */}
            <Link
              href="/profile?tab=worker"
              className={`${styles.dockItem} ${pathname === '/profile' && activeTabParam === 'worker' ? activeClass : ''}`}
            >
              <div className={styles.itemIconContainer}>
                <WrenchIcon size={20} />
              </div>
              <span className={styles.itemLabel}>{t('dock.trade_settings')}</span>
              <span className={styles.tooltip}>{t('dock.trade_settings')}</span>
            </Link>

            {/* 7. Account Settings */}
            <Link
              href="/profile?tab=account"
              className={`${styles.dockItem} ${pathname === '/profile' && (!activeTabParam || activeTabParam === 'account') ? activeClass : ''}`}
            >
              <div className={styles.itemIconContainer}>
                <SettingsIcon />
              </div>
              <span className={styles.itemLabel}>{t('dock.account_settings')}</span>
              <span className={styles.tooltip}>{t('dock.account_settings')}</span>
            </Link>
          </>
        ) : role === 'customer' ? (
          /* ── CUSTOMER ROLE NAVIGATION ────────────────────────── */
          <>
            {/* 1. Customer Home Dashboard */}
            <Link
              href="/dashboard"
              className={`${styles.dockItem} ${pathname === '/dashboard' || pathname === '/' ? activeClass : ''}`}
            >
              <div className={styles.itemIconContainer}>
                <DashboardIcon />
              </div>
              <span className={styles.itemLabel}>{t('dock.my_dashboard')}</span>
              <span className={styles.tooltip}>{t('dock.my_dashboard')}</span>
            </Link>

            {/* 2. Browse Workers Directory */}
            <Link
              href="/workers"
              className={`${styles.dockItem} ${pathname === '/workers' ? activeClass : ''}`}
            >
              <div className={styles.itemIconContainer}>
                <WorkersIcon />
              </div>
              <span className={styles.itemLabel}>{t('dock.browse_workers')}</span>
              <span className={styles.tooltip}>{t('dock.browse_workers')}</span>
            </Link>

            {/* 3. Profile & Account Settings */}
            <Link
              href="/profile"
              className={`${styles.dockItem} ${pathname === '/profile' ? activeClass : ''}`}
            >
              <div className={styles.itemIconContainer}>
                <SettingsIcon />
              </div>
              <span className={styles.itemLabel}>{t('nav.profile_settings')}</span>
              <span className={styles.tooltip}>{t('nav.profile_settings')}</span>
            </Link>

            <div className={styles.dockDivider} />

            {/* 4. AI Scanner CTA */}
            <Link
              href="/upload"
              className={`${styles.dockItem} ${styles.dockCtaItem}`}
            >
              <div className={styles.itemIconContainer}>
                <SparklesIcon size={20} />
              </div>
              <span className={styles.itemLabel}>{t('dock.ai_scanner')}</span>
              <span className={styles.tooltip}>{t('dock.ai_scanner')}</span>
            </Link>
          </>
        ) : (
          /* ── GUEST LOGGED OUT NAVIGATION ─────────────────────── */
          <>
            {/* 1. Home */}
            <Link
              href="/"
              className={`${styles.dockItem} ${pathname === '/' ? activeClass : ''}`}
            >
              <div className={styles.itemIconContainer}>
                <HomeIcon />
              </div>
              <span className={styles.itemLabel}>{t('dock.home_page')}</span>
              <span className={styles.tooltip}>{t('dock.home_page')}</span>
            </Link>

            {/* 2. Find Workers */}
            <Link
              href="/workers"
              className={`${styles.dockItem} ${pathname === '/workers' ? activeClass : ''}`}
            >
              <div className={styles.itemIconContainer}>
                <WorkersIcon />
              </div>
              <span className={styles.itemLabel}>{t('dock.find_workers')}</span>
              <span className={styles.tooltip}>{t('dock.find_workers')}</span>
            </Link>

            {/* 3. Sign In / Register */}
            <Link
              href="/auth/login"
              className={`${styles.dockItem} ${pathname?.startsWith('/auth') ? activeClass : ''}`}
            >
              <div className={styles.itemIconContainer}>
                <LoginIcon />
              </div>
              <span className={styles.itemLabel}>{t('dock.sign_in_register')}</span>
              <span className={styles.tooltip}>{t('dock.sign_in_register')}</span>
            </Link>

            <div className={styles.dockDivider} />

            {/* 4. AI Scanner CTA */}
            <Link
              href="/upload"
              className={`${styles.dockItem} ${styles.dockCtaItem}`}
            >
              <div className={styles.itemIconContainer}>
                <SparklesIcon size={20} />
              </div>
              <span className={styles.itemLabel}>{t('dock.ai_scanner')}</span>
              <span className={styles.tooltip}>{t('dock.ai_scanner')}</span>
            </Link>
          </>
        )}
      </div>
    </aside>
  );
}
