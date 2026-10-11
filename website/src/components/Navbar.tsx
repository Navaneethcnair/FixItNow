'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './Navbar.module.css';
import { useLanguage, Language } from '@/context/LanguageContext';

const LANGUAGES: { code: Language; label: string; native: string; flag: string }[] = [
  { code: 'en', label: 'English',  native: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'Hindi',    native: 'हिंदी',   flag: '🇮🇳' },
  { code: 'kn', label: 'Kannada',  native: 'ಕನ್ನಡ',   flag: '🇮🇳' },
];

export default function Navbar() {
  const { language, setLanguage, t } = useLanguage();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const langRef = useRef<HTMLDivElement>(null);

  // Close lang dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    if (langOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [langOpen]);

  const syncUserSession = useCallback(async () => {
    let currentUser: any = null;

    // 1. Instant synchronous check from localStorage (0ms latency)
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('fixitnow_user');
        if (raw) currentUser = JSON.parse(raw);
      } catch {}
    }

    // 2. Fallback to supabase auth check if not in localStorage
    if (!currentUser) {
      try {
        const { data } = await supabase.auth.getUser();
        currentUser = data?.user || null;
      } catch {}
    }

    setUser(currentUser);

    if (currentUser) {
      const defaultProfile = {
        id: currentUser.id,
        full_name: currentUser.user_metadata?.full_name || currentUser.full_name || currentUser.email?.split('@')[0] || 'User',
        email: currentUser.email,
        role: currentUser.user_metadata?.role || currentUser.role || 'customer',
      };
      setProfile(defaultProfile);
    } else {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    syncUserSession();

    const handleAuthEvent = () => syncUserSession();
    window.addEventListener('storage', handleAuthEvent);
    window.addEventListener('fixitnow_auth_change', handleAuthEvent);

    return () => {
      window.removeEventListener('storage', handleAuthEvent);
      window.removeEventListener('fixitnow_auth_change', handleAuthEvent);
    };
  }, [syncUserSession]);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrolled(window.scrollY > 10);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSignOut = async () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('fixitnow_user');
      window.dispatchEvent(new Event('fixitnow_auth_change'));
    }
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setMenuOpen(false);
    router.push('/');
    router.refresh();
  };

  const isActive = (path: string) => pathname === path;
  const initials = profile?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?';

  return (
    <nav className={`${styles.navbar} ${scrolled ? styles.scrolled : ''}`}>
      <div className={styles.inner}>
        {/* Logo */}
        <Link href={user ? (profile?.role === 'worker' ? '/worker-dashboard' : '/dashboard') : '/'} className={styles.logo}>
          <span className={styles.logoIcon}>🔧</span>
          <span className={styles.logoText}>Fix<span className={styles.logoAccent}>It</span>Now</span>
        </Link>

        {/* Nav Links */}
        <div className={styles.links}>
          {profile?.role === 'worker' ? (
            <>
              <Link href="/worker-dashboard" className={`${styles.link} ${isActive('/worker-dashboard') ? styles.linkActive : ''}`}>{t('nav.worker_dashboard')}</Link>
              <Link href="/profile" className={`${styles.link} ${isActive('/profile') ? styles.linkActive : ''}`}>{t('nav.profile_settings')}</Link>
            </>
          ) : (
            <>
              {!user && (
                <Link href="/" className={`${styles.link} ${isActive('/') ? styles.linkActive : ''}`}>{t('nav.home')}</Link>
              )}
              <Link href="/workers" className={`${styles.link} ${isActive('/workers') ? styles.linkActive : ''}`}>{t('nav.find_workers')}</Link>
              <Link href="/upload" className={`${styles.link} ${isActive('/upload') ? styles.linkActive : ''}`}>{t('nav.upload_problem')}</Link>
              {user && (
                <Link href="/dashboard" className={`${styles.link} ${isActive('/dashboard') ? styles.linkActive : ''}`}>{t('nav.dashboard')}</Link>
              )}
            </>
          )}
        </div>

        {/* Right side */}
        <div className={styles.right}>
          {/* Language Selector — Custom Dropdown */}
          <div className={styles.langDropdown} ref={langRef}>
            <button
              className={`${styles.langTrigger} ${langOpen ? styles.langTriggerOpen : ''}`}
              onClick={() => setLangOpen(o => !o)}
              aria-haspopup="listbox"
              aria-expanded={langOpen}
              aria-label="Select Language"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span className={styles.langTriggerLabel}>
                {LANGUAGES.find(l => l.code === language)?.native}
              </span>
              <svg className={`${styles.langChevron} ${langOpen ? styles.langChevronUp : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {langOpen && (
              <div className={styles.langPanel} role="listbox">
                <div className={styles.langPanelHeader}>Language / भाषा / ಭಾಷೆ</div>
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    role="option"
                    aria-selected={language === lang.code}
                    className={`${styles.langOption} ${language === lang.code ? styles.langOptionActive : ''}`}
                    onClick={() => { setLanguage(lang.code); setLangOpen(false); }}
                  >
                    <span className={styles.langFlag}>{lang.flag}</span>
                    <span className={styles.langNative}>{lang.native}</span>
                    <span className={styles.langEnglish}>{lang.label}</span>
                    {language === lang.code && (
                      <svg className={styles.langCheck} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {user ? (
            <>
              {profile?.role === 'worker' ? (
                <WorkerNavBell />
              ) : (
                <Link href="/upload" className="btn btn-primary btn-sm">
                  + {t('nav.upload_problem')}
                </Link>
              )}
              <div className={styles.userMenu}>
                <button className={styles.avatarBtn} onClick={() => setMenuOpen(!menuOpen)}>
                  <div className="avatar avatar-sm">{initials}</div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {menuOpen && (
                  <div className={styles.dropdown}>
                    <div className={styles.dropdownHeader}>
                      <div className="avatar avatar-md">{initials}</div>
                      <div>
                        <div className={styles.dropdownName}>{profile?.full_name || 'User'}</div>
                        <div className={styles.dropdownEmail}>{user.email}</div>
                      </div>
                    </div>
                    <div className={styles.dropdownDivider} />
                    
                    {profile?.role === 'worker' ? (
                      <>
                        <Link href="/worker-dashboard" className={styles.dropdownItem} onClick={() => setMenuOpen(false)}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.dropdownIcon}>
                            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                          </svg>
                          {t('nav.worker_dashboard')}
                        </Link>
                        <Link href="/profile" className={styles.dropdownItem} onClick={() => setMenuOpen(false)}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.dropdownIcon}>
                            <circle cx="12" cy="12" r="3"></circle>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                          </svg>
                          {t('nav.profile_settings')}
                        </Link>
                      </>
                    ) : (
                      <>
                        <Link href="/dashboard" className={styles.dropdownItem} onClick={() => setMenuOpen(false)}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.dropdownIcon}>
                            <rect x="3" y="3" width="7" height="7" rx="1" />
                            <rect x="14" y="3" width="7" height="7" rx="1" />
                            <rect x="14" y="14" width="7" height="7" rx="1" />
                            <rect x="3" y="14" width="7" height="7" rx="1" />
                          </svg>
                          {t('nav.dashboard')}
                        </Link>
                        <Link href="/workers" className={styles.dropdownItem} onClick={() => setMenuOpen(false)}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.dropdownIcon}>
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                          </svg>
                          {t('nav.find_workers')}
                        </Link>
                        <Link href="/upload" className={styles.dropdownItem} onClick={() => setMenuOpen(false)}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.dropdownIcon}>
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                          </svg>
                          {t('nav.upload_problem')}
                        </Link>
                        <Link href="/profile" className={styles.dropdownItem} onClick={() => setMenuOpen(false)}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.dropdownIcon}>
                            <circle cx="12" cy="12" r="3"></circle>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                          </svg>
                          {t('nav.profile_settings')}
                        </Link>
                      </>
                    )}
                    
                    <div className={styles.dropdownDivider} />
                    <button className={`${styles.dropdownItem} ${styles.signOut}`} onClick={handleSignOut}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.dropdownIcon}>
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                      </svg>
                      {t('nav.sign_out')}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="btn btn-ghost btn-sm">{t('nav.sign_in')}</Link>
              <Link href="/auth/signup" className="btn btn-primary btn-sm">{t('nav.get_started')}</Link>
            </>
          )}
        </div>
      </div>
      {menuOpen && <div className={styles.backdrop} onClick={() => setMenuOpen(false)} />}
    </nav>
  );
}

function WorkerNavBell() {
  const [pending, setPending] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch('/api/bookings?role=worker');
      const data = await res.json();
      const list: any[] = data.bookings || [];
      setPending(list.filter(b => b.status === 'requested' || !b.status));
    } catch {}
  }, []);

  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 12000);

    const handleBookingEvent = () => fetchPending();
    window.addEventListener('fixitnow_booking_change', handleBookingEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('fixitnow_booking_change', handleBookingEvent);
    };
  }, [fetchPending]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleAction = async (bookingId: string, status: string) => {
    setPending(prev => prev.filter(b => b.id !== bookingId));
    try {
      await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, status }),
      });
    } catch {}
    fetchPending();
  };

  return (
    <div className={styles.navBellWrap} ref={ref}>
      <button
        className={styles.navBellBtn}
        onClick={() => setOpen(o => !o)}
        title="Incoming Requests"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {pending.length > 0 && (
          <span className={styles.navBellBadge}>{pending.length}</span>
        )}
      </button>

      {open && (
        <div className={styles.navBellPanel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
            <strong style={{ fontSize: '13px', color: '#0f172a' }}>Pending Requests ({pending.length})</strong>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
          </div>

          {pending.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
              {pending.map((req) => (
                <div key={req.id} style={{ background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>{req.profiles?.full_name || 'Customer'}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{req.jobs?.ai_problem_title || 'Service Request'}</div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1, fontSize: '11px', padding: '4px 8px', background: '#10b981', borderColor: '#10b981', color: '#fff', fontWeight: 800 }}
                      onClick={() => { handleAction(req.id, 'accepted'); setOpen(false); }}
                    >
                      ✓ Accept
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, fontSize: '11px', padding: '4px 8px' }}
                      onClick={() => { handleAction(req.id, 'rejected'); setOpen(false); }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '12px 0', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
              No pending job requests right now.
            </div>
          )}

          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setOpen(false);
              router.push('/worker-dashboard?tab=requests');
            }}
            style={{ width: '100%', fontSize: '12px', color: '#4f46e5', textAlign: 'center' }}
          >
            Go to Worker Console →
          </button>
        </div>
      )}
    </div>
  );
}
