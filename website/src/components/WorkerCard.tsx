import Link from 'next/link';
import { Worker, TRADE_CONFIG } from '@/lib/types';
import { StarIcon, AwardIcon, MapPinIcon, BuildingIcon, CheckBadgeIcon, getTradeIcon } from '@/components/Icons';
import styles from './WorkerCard.module.css';
import { useLanguage } from '@/context/LanguageContext';

interface WorkerCardProps {
  worker: Worker & { profiles?: { full_name: string; avatar_url: string | null; city: string | null } };
  distanceKm?: number;
  jobId?: string;
}

export default function WorkerCard({ worker, distanceKm, jobId }: WorkerCardProps) {
  const { t } = useLanguage();
  const tradeKey = worker.trade || 'other';
  const trade = TRADE_CONFIG[tradeKey] || TRADE_CONFIG.other;
  const initials = worker.profiles?.full_name?.split(' ').map((n) => n[0]).join('').toUpperCase() || 'W';

  const isDemoAccount = worker.id === 'w1' || worker.id === 'w2' || worker.id === 'w16' || worker.id === 'w17' || worker.id.startsWith('mock-');

  const workerName = worker.profiles?.full_name || (worker as any).name || (isDemoAccount ? 'Santosh Poojary' : 'Worker Specialist');
  const displayCity = worker.profiles?.city || (worker as any).city || (isDemoAccount ? 'Mangaluru' : 'Nearby');
  const displayDistance = distanceKm !== undefined ? distanceKm : (worker as any).distance_km || 15.0;

  // Real vs Demo account values
  const totalReviews = typeof worker.total_reviews === 'number' ? worker.total_reviews : (isDemoAccount ? 84 : 0);
  const ratingVal = typeof worker.rating === 'number' && worker.rating > 0 ? worker.rating : (isDemoAccount ? 4.8 : 0.0);
  const expYears = worker.experience_years ?? (isDemoAccount ? 7 : 1);
  const isVerified = worker.is_verified ?? isDemoAccount;
  const hourlyRate = worker.hourly_rate ?? (isDemoAccount ? 320 : 250);
  const workerBio = worker.bio || (isDemoAccount ? 'Handyman and gadget repair technician in coastal Karnataka.' : 'Certified blue-collar specialist offering prompt, quality service.');

  return (
    <div className={styles.card}>
      {/* Header Row */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href={`/worker/${worker.id}`} className={styles.avatarWrap} title={`View ${workerName}'s Profile`}>
            {worker.profiles?.avatar_url ? (
              <img src={worker.profiles.avatar_url} alt={workerName} className={styles.avatar} />
            ) : (
              <div className={styles.avatarFallback}>{initials}</div>
            )}
            <span className={`${styles.statusDot} ${worker.is_available !== false ? styles.online : styles.offline}`} />
          </Link>

          <div className={styles.info}>
            <div className={styles.nameRow}>
              <Link href={`/worker/${worker.id}`}>
                <h3 className={styles.name}>{workerName}</h3>
              </Link>
              {isVerified && (
                <span className={styles.verified} title="Verified Worker">
                  <CheckBadgeIcon size={12} /> Verified
                </span>
              )}
            </div>

            <div className={styles.tradeBadge}>
              <span className={styles.tradeIconWrap}>{getTradeIcon(tradeKey, 13)}</span>
              <span>{trade.label} Worker</span>
            </div>
          </div>
        </div>

        {/* Rate Top Right */}
        <div className={styles.rateWrap}>
          <div className={styles.rate}>₹{hourlyRate}<span>/hr</span></div>
        </div>
      </div>

      <div className={styles.divider} />

      {/* Stats Row - Real accounts display dynamic real-time values, demo accounts show demo values */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statIconStar}>
            <StarIcon size={13} />
          </span>
          <span className={styles.statVal}>{ratingVal > 0 ? ratingVal.toFixed(1) : 'New'}</span>
          <span className={styles.statLbl}>({totalReviews} {totalReviews === 1 ? 'review' : 'reviews'})</span>
        </div>

        <div className={styles.stat}>
          <span className={styles.statIconAward}>
            <AwardIcon size={13} />
          </span>
          <span className={styles.statVal}>{expYears}y</span>
          <span className={styles.statLbl}>experience</span>
        </div>

        <div className={styles.stat}>
          <span className={styles.statIconPin}>
            <MapPinIcon size={13} />
          </span>
          <span className={styles.statVal}>{typeof displayDistance === 'number' ? displayDistance.toFixed(1) : displayDistance}km</span>
          <span className={styles.statLbl}>away</span>
        </div>

        {displayCity && (
          <div className={styles.stat}>
            <span className={styles.statIconCity}>
              <BuildingIcon size={13} />
            </span>
            <span className={styles.statLbl}>{displayCity}</span>
          </div>
        )}
      </div>

      {/* Bio Description */}
      {workerBio && <p className={styles.bio}>{workerBio}</p>}

      {/* Action Buttons */}
      <div className={styles.actions}>
        <Link href={`/worker/${worker.id}`} className={styles.viewProfileBtn}>
          View Profile
        </Link>
        <Link
          href={jobId ? `/book/${jobId}?workerId=${worker.id}` : `/book/new?workerId=${worker.id}`}
          className={styles.bookNowBtn}
        >
          Book Service Now →
        </Link>
      </div>
    </div>
  );
}
