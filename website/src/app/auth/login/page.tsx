'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { WrenchIcon, GoogleIcon } from '@/components/Icons';
import { useLanguage } from '@/context/LanguageContext';
import styles from '../auth.module.css';

function LoginForm() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  const supabase = createClient();

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError('');
    const callbackOrigin = typeof window !== 'undefined'
      ? (window.location.hostname === '0.0.0.0' ? window.location.origin.replace('0.0.0.0', 'localhost') : window.location.origin)
      : '';
    const emailParam = email.trim() ? `?email=${encodeURIComponent(email.trim())}` : '';
    const sep = emailParam ? '&' : '?';
    const redirectParam = redirect && redirect !== '/' ? `${sep}next=${encodeURIComponent(redirect)}` : '';
    const redirectTo = `${callbackOrigin}/auth/callback${emailParam}${redirectParam}`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const cleanEmail = email.trim();

    const { data, error: signInErr } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (signInErr || !data?.user) {
      setError(signInErr?.message || 'Invalid email or password. Please check your credentials or create an account.');
      setLoading(false);
      return;
    }

    const user = data.user;
    let role = user.user_metadata?.role || 'customer';

    try {
      const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (p?.role) role = p.role;
    } catch {}

    const redirectParam = searchParams.get('redirect');
    if (redirectParam && redirectParam !== '/') {
      router.push(redirectParam);
      router.refresh();
      return;
    }

    if (role === 'worker') {
      router.push('/worker-dashboard');
    } else {
      router.push('/upload');
    }
    router.refresh();
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Link href="/" className={styles.logo}><WrenchIcon size={22} /> FixItNow</Link>
          <h1 className={styles.title}>{t('auth.welcome_back')}</h1>
          <p className={styles.subtitle}>{t('auth.sign_in_subtitle')}</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <span>⚠️</span> {error}
          </div>
        )}

        <button
          type="button"
          className={styles.googleBtn}
          onClick={handleGoogleLogin}
          disabled={loading || googleLoading}
        >
          {googleLoading ? (
            <><span className="spinner" /> Connecting to Google...</>
          ) : (
            <><GoogleIcon size={20} /> {t('auth.continue_google')}</>
          )}
        </button>

        <div className={styles.divider}>
          <hr className={styles.dividerLine} />
          <span className={styles.dividerText}>{t('auth.or_sign_in_email')}</span>
          <hr className={styles.dividerLine} />
        </div>

        <form onSubmit={handleLogin} className={styles.form} suppressHydrationWarning>
          <div className="form-group">
            <label className="form-label">{t('auth.email_label')}</label>
            <div className="form-input-icon">
              <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <input
                type="email"
                className="form-input"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                suppressHydrationWarning
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('auth.password_label')}</label>
            <div className="form-input-icon">
              <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                suppressHydrationWarning
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? <><span className="spinner" />{t('auth.signing_in')}</> : t('auth.sign_in_btn')}
          </button>
        </form>

        <p className={styles.footer}>
          {t('auth.no_account')}{' '}
          <Link href="/auth/signup" className={styles.link}>{t('auth.create_one_free')}</Link>
        </p>
      </div>

      {/* Decorative */}
      <div className={styles.blob1} />
      <div className={styles.blob2} />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner spinner-lg" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
