'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TRADE_CONFIG, TradeType } from '@/lib/types';
import CustomSelect from '@/components/CustomSelect';
import { getTradeIcon, WrenchIcon, GoogleIcon, UserIcon } from '@/components/Icons';
import { useLanguage } from '@/context/LanguageContext';
import styles from '../../auth.module.css';

const TRADES: TradeType[] = ['plumber', 'electrician', 'carpenter', 'painter', 'ac_tech', 'welder', 'mason', 'other'];

export default function WorkerSignupPage() {
  const { t } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [trade, setTrade] = useState<TradeType | ''>('');
  const [customTradeText, setCustomTradeText] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const TRADE_OPTIONS = TRADES.map(trKey => ({
    value: trKey,
    label: trKey === 'other' ? t('trade.other') : t(`trade.${trKey}`),
    icon: getTradeIcon(trKey, 16),
  }));

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    setError('');
    const callbackOrigin = typeof window !== 'undefined'
      ? (window.location.hostname === '0.0.0.0' ? window.location.origin.replace('0.0.0.0', 'localhost') : window.location.origin)
      : '';
    const emailParam = email.trim() ? `&email=${encodeURIComponent(email.trim())}` : '';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${callbackOrigin}/auth/callback?next=/worker-dashboard${emailParam}`,
        data: { role: 'worker' },
      },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!trade) {
      setError('Please select your primary trade.');
      setLoading(false);
      return;
    }

    if (trade === 'other' && !customTradeText.trim()) {
      setError('Please specify the trade or type of work you do.');
      setLoading(false);
      return;
    }

    const cleanEmail = email.trim();

    // 1. Supabase Signup
    const { data } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { full_name: fullName, role: 'worker', phone },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    const userId = data?.user?.id || `worker-${Date.now()}`;
    const workerBio = trade === 'other' && customTradeText.trim()
      ? `Specialty: ${customTradeText.trim()}`
      : null;

    if (data?.user) {
      try {
        await supabase.from('profiles').insert({
          id: userId,
          full_name: fullName,
          phone,
          role: 'worker',
        });

        await supabase.from('workers').insert({
          id: userId,
          trade,
          bio: workerBio,
          experience_years: 0,
          hourly_rate: 0,
          rating: 0,
          total_reviews: 0,
          is_available: true,
          is_verified: false,
          radius_km: 20,
        });
      } catch {}
    }

    // 2. Persistent Local Store & Session Fallback
    const localUser = {
      id: userId,
      email: cleanEmail,
      password,
      full_name: fullName,
      role: 'worker',
      phone,
      trade: trade || 'other',
      city: 'Bengaluru',
      bio: workerBio,
    };

    try {
      await fetch('/api/local-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'users',
          action: 'insert',
          data: localUser,
        }),
      });

      await fetch('/api/local-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'profiles',
          action: 'insert',
          data: {
            id: userId,
            full_name: fullName,
            email: cleanEmail,
            role: 'worker',
            city: 'Bengaluru',
          },
        }),
      });

      await fetch('/api/local-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'workers',
          action: 'insert',
          data: {
            id: userId,
            trade: trade || 'other',
            bio: workerBio || 'Certified repair specialist offering prompt, reliable home service.',
            experience_years: 2,
            hourly_rate: 350,
            rating: 0,
            total_reviews: 0,
            is_available: true,
            is_verified: true,
            radius_km: 20,
          },
        }),
      });
    } catch {}

    if (typeof window !== 'undefined') {
      window.localStorage.setItem('fixitnow_user', JSON.stringify({
        id: userId,
        email: cleanEmail,
        user_metadata: { full_name: fullName, role: 'worker', phone }
      }));
    }

    setSuccess(true);
    setTimeout(() => {
      router.push('/worker-dashboard');
      router.refresh();
    }, 1800);
  };

  if (success) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.successState}>
            <div className={styles.successIcon}>🎉</div>
            <h2>Worker Account Created!</h2>
            <p>Welcome to FixItNow. Redirecting to your worker dashboard...</p>
          </div>
        </div>
        <div className={styles.blob1} />
        <div className={styles.blob2} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Link href="/" className={styles.logo}>
            <WrenchIcon size={24} /> FixItNow
          </Link>

          <div className={styles.roleToggle} style={{ width: '100%', margin: '4px 0 8px 0' }}>
            <Link href="/auth/signup/customer" className={styles.roleBtn}>
              <UserIcon size={16} /> {t('auth.homeowner_client')}
            </Link>
            <span className={`${styles.roleBtn} ${styles.roleActive}`}>
              <WrenchIcon size={16} /> {t('auth.service_pro_worker')}
            </span>
          </div>

          <h1 className={styles.title}>{t('auth.register_as_worker')}</h1>
          <p className={styles.subtitle}>{t('auth.worker_subtitle')}</p>
        </div>

        {error && <div className="alert alert-error"><span>⚠️</span> {error}</div>}

        <button
          type="button"
          className={styles.googleBtn}
          onClick={handleGoogleSignup}
          disabled={loading || googleLoading}
        >
          {googleLoading ? (
            <><span className="spinner" /> {t('auth.connecting_google')}</>
          ) : (
            <><GoogleIcon size={20} /> {t('auth.sign_up_google')}</>
          )}
        </button>

        <div className={styles.divider}>
          <hr className={styles.dividerLine} />
          <span className={styles.dividerText}>{t('auth.or_register_email')}</span>
          <hr className={styles.dividerLine} />
        </div>

        <form onSubmit={handleSignup} className={styles.form} suppressHydrationWarning>
          <div className="form-group">
            <label className="form-label">{t('auth.full_name')}</label>
            <div className="form-input-icon">
              <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <input type="text" className="form-input" placeholder="e.g. Ramesh Kumar" value={fullName} onChange={e => setFullName(e.target.value)} required suppressHydrationWarning />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('auth.phone_number')}</label>
            <div className="form-input-icon">
              <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.65 3.27 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.69a16 16 0 0 0 6.29 6.29l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <input type="tel" className="form-input" placeholder="e.g. +91 98765 11111" value={phone} onChange={e => setPhone(e.target.value)} required suppressHydrationWarning />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('auth.select_primary_trade')}</label>
            <CustomSelect
              options={TRADE_OPTIONS}
              value={trade}
              onChange={(val) => setTrade(val as TradeType)}
              placeholder={t('auth.select_trade_placeholder')}
            />
          </div>

          {/* Conditional text input field ONLY when 'other' is explicitly selected by the user */}
          {trade === 'other' && (
            <div className="form-group" style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
              <label className="form-label">{t('auth.specify_trade_label')}</label>
              <div className="form-input-icon">
                <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Locksmith, Solar Tech, Roofing, Appliance Repair"
                  value={customTradeText}
                  onChange={e => setCustomTradeText(e.target.value)}
                  required
                  suppressHydrationWarning
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{t('auth.email_address')}</label>
            <div className="form-input-icon">
              <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <input type="email" className="form-input" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" suppressHydrationWarning />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('auth.password')}</label>
            <div className="form-input-icon">
              <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input type="password" className="form-input" placeholder="Min. 6 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" suppressHydrationWarning />
            </div>
          </div>

          <button type="submit" className="btn btn-secondary btn-full btn-lg" disabled={loading} style={{ marginTop: '8px' }}>
            {loading ? <><span className="spinner" />{t('auth.creating_account')}</> : t('auth.create_worker_account')}
          </button>
        </form>

        <p className={styles.footer}>
          {t('auth.already_account')}{' '}
          <Link href="/auth/login" className={styles.link}>{t('auth.sign_in')}</Link>
        </p>
      </div>
      <div className={styles.blob1} />
      <div className={styles.blob2} />
    </div>
  );
}
