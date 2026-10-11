'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { UserIcon, WrenchIcon, CheckBadgeIcon, SparklesIcon } from '@/components/Icons';
import { useLanguage } from '@/context/LanguageContext';
import styles from '../auth.module.css';

export default function SignupPortal() {
  const { t } = useLanguage();
  const [error, setError] = useState('');
  const supabase = createClient();

  return (
    <div className={styles.page}>
      <div className={`${styles.card} ${styles.portalCard}`}>
        <div className={styles.header}>
          <Link href="/" className={styles.logo}>
            <WrenchIcon size={26} /> FixItNow
          </Link>
          <span className="section-tag" style={{ margin: '4px 0 10px 0' }}>
            <SparklesIcon size={14} /> {t('auth.get_started_hub')}
          </span>
          <h1 className={styles.title}>{t('auth.join_title')}</h1>
          <p className={styles.subtitle}>
            {t('auth.join_subtitle')}
          </p>
        </div>

        {error && (
          <div className="alert alert-error" style={{ maxWidth: '480px', width: '100%', margin: '0 auto' }}>
            <span>⚠️</span> {error}
          </div>
        )}

        <div className={styles.portalGrid}>
          {/* Choice 1: Customer */}
          <Link href="/auth/signup/customer" className={`${styles.portalChoice} ${styles.portalChoiceCustomer}`}>
            <div className={styles.badgePopular}>{t('auth.homeowners_badge')}</div>
            <div className={styles.portalIconBadgeCustomer}>
              <UserIcon size={38} />
            </div>

            <h2 className={styles.portalTitle}>{t('auth.homeowner_title')}</h2>
            <p className={styles.portalText}>
              {t('auth.homeowner_desc')}
            </p>

            <div className={styles.featureList}>
              <div className={styles.featureItem}>
                <CheckBadgeIcon size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span>{t('auth.homeowner_feature_1')}</span>
              </div>
              <div className={styles.featureItem}>
                <CheckBadgeIcon size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span>{t('auth.homeowner_feature_2')}</span>
              </div>
              <div className={styles.featureItem}>
                <CheckBadgeIcon size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span>{t('auth.homeowner_feature_3')}</span>
              </div>
            </div>

            <span className={`btn btn-primary btn-md ${styles.actionBtn}`}>
              {t('auth.homeowner_cta')}
            </span>
          </Link>

          {/* Choice 2: Worker */}
          <Link href="/auth/signup/worker" className={`${styles.portalChoice} ${styles.portalChoiceWorker}`}>
            <div className={styles.badgePro}>{t('auth.pro_badge')}</div>
            <div className={styles.portalIconBadgeWorker}>
              <WrenchIcon size={38} />
            </div>

            <h2 className={styles.portalTitle}>{t('auth.worker_title')}</h2>
            <p className={styles.portalText}>
              {t('auth.worker_desc')}
            </p>

            <div className={styles.featureList}>
              <div className={styles.featureItem}>
                <CheckBadgeIcon size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span>{t('auth.worker_feature_1')}</span>
              </div>
              <div className={styles.featureItem}>
                <CheckBadgeIcon size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span>{t('auth.worker_feature_2')}</span>
              </div>
              <div className={styles.featureItem}>
                <CheckBadgeIcon size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span>{t('auth.worker_feature_3')}</span>
              </div>
            </div>

            <span className={`btn btn-secondary btn-md ${styles.actionBtn}`}>
              {t('auth.worker_cta')}
            </span>
          </Link>
        </div>

        {/* Trust Signals */}
        <div className={styles.trustBar}>
          <div className={styles.trustItem}>
            <span>⚡</span> <span>{t('auth.trust_dispatch')}</span>
          </div>
          <div className={styles.trustItem}>
            <span>🛡️</span> <span>{t('auth.trust_verified')}</span>
          </div>
          <div className={styles.trustItem}>
            <span>🤖</span> <span>{t('auth.trust_ai')}</span>
          </div>
        </div>

        <p className={styles.footer} style={{ marginTop: 'var(--space-1)' }}>
          {t('auth.already_account')}{' '}
          <Link href="/auth/login" className={styles.link}>{t('auth.sign_in')}</Link>
        </p>
      </div>

      <div className={styles.blob1} />
      <div className={styles.blob2} />
    </div>
  );
}
