'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './MobileBottomNav.module.css';
import { useLanguage } from '@/context/LanguageContext';

export default function MobileBottomNav() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<'customer' | 'worker' | null>(null);

  const syncUser = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('fixitnow_user');
        if (raw) {
          const parsed = JSON.parse(raw);
          setUser(parsed);
          setRole(parsed?.user_metadata?.role || parsed?.role || 'customer');
          return;
        }
      } catch {}
      setUser(null);
      setRole(null);
    }
  }, []);

  useEffect(() => {
    syncUser();
    const handler = () => syncUser();
    window.addEventListener('storage', handler);
    window.addEventListener('fixitnow_auth_change', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('fixitnow_auth_change', handler);
    };
  }, [syncUser]);

  const isActive = (path: string) => pathname === path;

  return (
    <nav className={styles.mobileBottomNav} aria-label="Mobile Bottom Navigation">
      {/* Home */}
      <Link
        href={role === 'worker' ? '/worker-dashboard' : '/'}
        className={`${styles.navItem} ${isActive(role === 'worker' ? '/worker-dashboard' : '/') ? styles.navItemActive : ''}`}
      >
        <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span>{t('nav.home')}</span>
      </Link>

      {/* Find Workers */}
      <Link
        href="/workers"
        className={`${styles.navItem} ${isActive('/workers') ? styles.navItemActive : ''}`}
      >
        <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <span>{t('nav.find_workers').includes(' ') ? t('nav.find_workers').split(' ').pop() : t('nav.find_workers')}</span>
      </Link>

      {/* Upload Problem Action Button */}
      <Link
        href="/upload"
        className={`${styles.navItem} ${styles.uploadItem}`}
      >
        <div className={styles.uploadBtnInner}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
        <span className={styles.uploadLabel}>{t('nav.upload_problem').split(' ')[0]}</span>
      </Link>

      {/* Dashboard */}
      <Link
        href={role === 'worker' ? '/worker-dashboard' : (user ? '/dashboard' : '/auth/login')}
        className={`${styles.navItem} ${isActive(role === 'worker' ? '/worker-dashboard' : '/dashboard') ? styles.navItemActive : ''}`}
      >
        <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
        <span>{t('nav.dashboard')}</span>
      </Link>

      {/* Profile / Account */}
      <Link
        href={user ? '/profile' : '/auth/login'}
        className={`${styles.navItem} ${isActive('/profile') || isActive('/auth/login') ? styles.navItemActive : ''}`}
      >
        <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        <span>{user ? (t('nav.profile_settings').split(' ')[0]) : t('nav.sign_in')}</span>
      </Link>
    </nav>
  );
}
