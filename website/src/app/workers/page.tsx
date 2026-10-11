'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import WorkerCard from '@/components/WorkerCard';
import { TRADE_CONFIG, TradeType } from '@/lib/types';
import CustomSelect from '@/components/CustomSelect';
import { MapPinIcon, StarIcon, RupeeIcon, AwardIcon } from '@/components/Icons';
import styles from './workers.module.css';
import { useLanguage } from '@/context/LanguageContext';

const TRADES: TradeType[] = ['plumber', 'electrician', 'carpenter', 'painter', 'ac_tech', 'welder', 'mason', 'other'];
const SORT_OPTIONS = [
  { value: 'distance', label: 'Distance (Nearest)', icon: <MapPinIcon size={16} />, description: 'Closest workers near your location' },
  { value: 'rating', label: 'Rating (Highest)', icon: <StarIcon size={16} />, description: 'Top-rated service professionals' },
  { value: 'price_asc', label: 'Price (Lowest first)', icon: <RupeeIcon size={16} />, description: 'Budget friendly hourly rates' },
  { value: 'experience', label: 'Experience (Years)', icon: <AwardIcon size={16} />, description: 'Most seasoned professionals' },
];

function WorkersContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const initialTrade = searchParams.get('trade') || '';
  const [selectedTrade, setSelectedTrade] = useState(initialTrade);
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Advanced client-side search, sort & availability filters
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('distance');
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const translatedSortOptions = SORT_OPTIONS.map(opt => ({
    ...opt,
    label: t(`sort.${opt.value}`)
  }));

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      );
    }
  }, []);

  useEffect(() => {
    const fetchWorkers = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedTrade) params.set('trade', selectedTrade);
      if (location) {
        params.set('lat', location.lat.toString());
        params.set('lng', location.lng.toString());
      }
      const res = await fetch(`/api/workers?${params.toString()}`);
      const data = await res.json();
      setWorkers(data.workers || []);
      setLoading(false);
    };
    fetchWorkers();
  }, [selectedTrade, location]);

  // Apply filters and sorting locally
  const processedWorkers = workers
    .filter((w) => {
      // 1. Search Query Filter (name or city)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const name = (w.profiles?.full_name || '').toLowerCase();
        const city = (w.profiles?.city || '').toLowerCase();
        if (!name.includes(query) && !city.includes(query)) return false;
      }
      // 2. Availability Filter
      if (onlyAvailable && !w.is_available) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Prioritize newly created worker accounts at the top so customers see them immediately
      if (a.is_new_account && !b.is_new_account) return -1;
      if (!a.is_new_account && b.is_new_account) return 1;

      // 3. Sorting
      if (sortBy === 'rating') {
        return b.rating - a.rating;
      }
      if (sortBy === 'price_asc') {
        return Number(a.hourly_rate) - Number(b.hourly_rate);
      }
      if (sortBy === 'experience') {
        return b.experience_years - a.experience_years;
      }
      // Default: distance
      const distA = a.distance_km !== undefined ? a.distance_km : 999;
      const distB = b.distance_km !== undefined ? b.distance_km : 999;
      return distA - distB;
    });

  return (
    <div className={styles.page}>
      <div className="container">
        {/* Header */}
        <div className={styles.header}>
          <span className="section-tag">✦ {t('workers.service_directory')}</span>
          <h1 className="section-title">{t('workers.find_verified_workers')}</h1>
          <p className="section-subtitle">{t('workers.browse_subtitle')}</p>
        </div>

        {/* Trade Filters */}
        <div className={styles.filters}>
          <button
            className={`chip ${!selectedTrade ? 'active' : ''}`}
            onClick={() => setSelectedTrade('')}
          >
            {t('workers.all_trades')}
          </button>
          {TRADES.map(tKey => (
            <button
              key={tKey}
              className={`chip ${selectedTrade === tKey ? 'active' : ''}`}
              onClick={() => setSelectedTrade(tKey)}
            >
              {TRADE_CONFIG[tKey].emoji} {t(`trade.${tKey}`)}
            </button>
          ))}
        </div>

        {/* Advanced Filters Toolbar */}
        <div className={styles.filterToolbar}>
          {/* Search bar */}
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder={t('workers.search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          {/* Sorting controls */}
          <div className={styles.sortWrap}>
            <span className={styles.sortLabel}>{t('workers.sort_by')}</span>
            <CustomSelect
              options={translatedSortOptions}
              value={sortBy}
              onChange={setSortBy}
              variant="pill"
              fullWidth={false}
            />
          </div>

          {/* Advanced filters */}
          <label className={styles.availSwitch}>
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(e) => setOnlyAvailable(e.target.checked)}
              className={styles.checkboxInput}
            />
            <span className={styles.checkboxSlider} />
            <span className={styles.checkboxLabel}>{t('workers.online_available')}</span>
          </label>
        </div>

        {/* Workers Grid */}
        {loading ? (
          <div className={styles.loadingState}>
            <div className="spinner spinner-lg" />
            <p>{t('workers.finding_workers')}</p>
          </div>
        ) : processedWorkers.length > 0 ? (
          <div className={styles.grid}>
            {processedWorkers.map((w: any) => (
              <WorkerCard key={w.id} worker={w} distanceKm={w.distance_km} />
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🔍</div>
            <h3>{t('workers.no_matching_workers')}</h3>
            <p>{t('workers.clear_filters_hint')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WorkersPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner spinner-lg" /></div>}>
      <WorkersContent />
    </Suspense>
  );
}
