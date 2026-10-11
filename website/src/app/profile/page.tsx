'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TRADE_CONFIG, TradeType } from '@/lib/types';
import CustomSelect from '@/components/CustomSelect';
import {
  MapPinIcon,
  AwardIcon,
  CheckBadgeIcon,
  CameraIcon,
  UserIcon,
  WrenchIcon,
  SparklesIcon,
  ServiceIcon,
  getTradeIcon,
} from '@/components/Icons';
import styles from './profile.module.css';
import { useLanguage } from '@/context/LanguageContext';

const TRADES: TradeType[] = ['plumber', 'electrician', 'carpenter', 'painter', 'ac_tech', 'welder', 'mason', 'other'];
const TRADE_OPTIONS = TRADES.map((t) => ({
  value: t,
  label: TRADE_CONFIG[t].label,
  icon: getTradeIcon(t, 16),
}));

const TRADE_SERVICES: Record<string, string[]> = {
  plumber: [
    'Pipe Leak & Burst Repair',
    'Tap, Faucet & Mixer Installation',
    'Drain Unclogging & Cleaning',
    'Water Heater / Geyser Service',
    'Sanitary & Bathroom Fitting Replacement',
    'Overhead Tank & Pump Maintenance',
  ],
  electrician: [
    'Short Circuit & MCB Trip Repair',
    'Full House Wiring & Diagnostics',
    'Fan, Light & Chandelier Installation',
    'Switchboard & Socket Replacement',
    'Inverter & Battery Setup',
    'Appliance Power Cord Repair',
  ],
  carpenter: [
    'Door Lock, Latch & Hinge Replacement',
    'Furniture Assembly & Repair',
    'Modular Kitchen & Drawer Alignment',
    'Custom Wooden Shelves & Cabinets',
    'Window & Frame Polishing / Sealing',
    'Wood Scratch & Chip Restoration',
  ],
  painter: [
    'Interior Wall & Ceiling Painting',
    'Exterior Weatherproof Coating',
    'Dampness & Waterproofing Treatment',
    'Wall Putty & Primer Finishing',
    'Texture & Accent Wall Design',
    'Door & Window Enamel Painting',
  ],
  ac_tech: [
    'Split & Window AC Servicing / Cleaning',
    'Gas Leakage Check & Refilling',
    'Cooling & Thermostat Fault Repair',
    'AC Mounting & Dismantling',
    'PCB Board Diagnostics',
    'Drainage Pipe Unclogging',
  ],
  welder: [
    'Metal Gate & Door Hinge Welding',
    'Window Safety Grill Installation',
    'Railing & Fence Repair',
    'Structural Steel Welding',
    'Custom Iron Frame Fabrication',
  ],
  mason: [
    'Tile Fitting & Grouting Repair',
    'Plastering & Wall Crack Filling',
    'Concrete Floor & Step Touchups',
    'Brickwork & Masonry Alteration',
    'Waterproof Cementing',
  ],
  other: [
    'General Handyman Repairs',
    'Household Appliance Troubleshooting',
    'Fixtures Mounting & Drilling',
    'Minor Maintenance Jobs',
  ],
};

function ProfileForm() {
  const searchParams = useSearchParams();
  const initialTabParam = searchParams.get('tab');
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'account' | 'location' | 'worker'>(
    initialTabParam === 'location' ? 'location' : initialTabParam === 'worker' ? 'worker' : 'account'
  );
  const [showAvatarInput, setShowAvatarInput] = useState(false);

  // Profile data
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [role, setRole] = useState<'customer' | 'worker'>('customer');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [joinedAt, setJoinedAt] = useState('');

  // Worker data
  const [trade, setTrade] = useState<TradeType>('other');
  const [bio, setBio] = useState('');
  const [experience, setExperience] = useState(0);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [radiusKm, setRadiusKm] = useState(20);
  const [isAvailable, setIsAvailable] = useState(true);
  const [servicesOffered, setServicesOffered] = useState<string[]>([]);
  const [customServiceInput, setCustomServiceInput] = useState('');

  const [detectingLoc, setDetectingLoc] = useState(false);
  const [user, setUser] = useState<any>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const updateAndSaveServices = async (newServices: string[]) => {
    setServicesOffered(newServices);

    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('fixitnow_user');
        if (raw) {
          const u = JSON.parse(raw);
          const updatedUser = {
            ...u,
            user_metadata: {
              ...u.user_metadata,
              services_offered: newServices,
            }
          };
          localStorage.setItem('fixitnow_user', JSON.stringify(updatedUser));
          window.dispatchEvent(new CustomEvent('fixitnow_services_change', { detail: { services: newServices, userId: u.id } }));
          window.dispatchEvent(new Event('storage'));
        }
      } catch {}
    }

    if (user?.id) {
      try {
        await supabase
          .from('workers')
          .update({ services_offered: newServices })
          .eq('id', user.id);
      } catch {}
    }
  };

  useEffect(() => {
    if (initialTabParam === 'location') setActiveTab('location');
    else if (initialTabParam === 'worker') setActiveTab('worker');
    else if (initialTabParam === 'account') setActiveTab('account');
  }, [initialTabParam]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setAvatarUrl(result);
        setSuccess('Profile picture loaded! Click Save Profile Settings to persist changes.');
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        let authUser: any = null;
        try {
          const { data } = await supabase.auth.getUser();
          authUser = data?.user || null;
        } catch {}

        if (!authUser && typeof window !== 'undefined') {
          try {
            const raw = window.localStorage.getItem('fixitnow_user');
            if (raw) authUser = JSON.parse(raw);
          } catch {}
        }

        if (!authUser) {
          setLoading(false);
          router.push('/auth/login?redirect=/profile');
          return;
        }
        setUser(authUser);

        const { data: p } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (p) {
          setFullName(p.full_name || authUser.user_metadata?.full_name || '');
          setPhone(p.phone || authUser.user_metadata?.phone || '');
          setCity(p.city || '');
          setLat(p.location_lat || null);
          setLng(p.location_lng || null);
          setRole(p.role || authUser.user_metadata?.role || 'customer');
          setAvatarUrl(p.avatar_url || authUser.user_metadata?.avatar_url || null);
          if (p.created_at) {
            setJoinedAt(new Date(p.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' }));
          }

          if (p.role === 'worker' || authUser.user_metadata?.role === 'worker') {
            const { data: w } = await supabase.from('workers').select('*').eq('id', authUser.id).single();
            const loadedTrade = w?.trade || authUser.user_metadata?.trade || 'other';
            setTrade(loadedTrade as TradeType);
            setBio(w?.bio || authUser.user_metadata?.bio || '');
            setExperience(w?.experience_years || authUser.user_metadata?.experience_years || 5);
            setHourlyRate(Number(w?.hourly_rate || authUser.user_metadata?.hourly_rate) || 350);
            setRadiusKm(w?.radius_km || authUser.user_metadata?.radius_km || 20);
            setIsAvailable(w?.is_available ?? authUser.user_metadata?.is_available ?? true);

            const existingServices = w?.services_offered || authUser.user_metadata?.services_offered;
            if (existingServices && Array.isArray(existingServices) && existingServices.length > 0) {
              setServicesOffered(existingServices);
            } else {
              setServicesOffered(TRADE_SERVICES[loadedTrade] || TRADE_SERVICES.other);
            }
          }
        } else {
          const meta = authUser.user_metadata || {};
          const name = meta.full_name || meta.name || authUser.email?.split('@')[0] || 'User';
          const avatarFromGoogle = meta.avatar_url || meta.picture || null;
          const userRole = meta.role || 'customer';

          setFullName(name);
          setAvatarUrl(avatarFromGoogle);
          setRole(userRole);
          setPhone(meta.phone || '');

          try {
            await supabase.from('profiles').upsert({
              id: authUser.id,
              full_name: name,
              email: authUser.email,
              role: userRole,
              avatar_url: avatarFromGoogle,
            }, { onConflict: 'id' });
          } catch {}
        }
      } catch (err: any) {
        console.error('Error fetching profile:', err);
        setError(err?.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDetectLocation = () => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setDetectingLoc(true);
    setError('');
    setSuccess('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        setLat(latitude);
        setLng(longitude);

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await res.json();
          const cityVal = data.address?.city || data.address?.town || data.address?.village || data.address?.suburb || '';
          if (cityVal) {
            setCity(cityVal);
          }
          setSuccess('Location coordinates successfully mapped!');
        } catch {
          setSuccess('Location coordinates detected!');
        } finally {
          setDetectingLoc(false);
        }
      },
      (err) => {
        console.error('Geolocation error:', err);
        setError('Failed to detect location. Please check browser permissions.');
        setDetectingLoc(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // 1. Update Profile
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone,
          city,
          location_lat: lat,
          location_lng: lng,
          avatar_url: avatarUrl,
        })
        .eq('id', user.id);

      if (profileErr) throw profileErr;

      // 2. Update Worker parameters if role is worker
      if (role === 'worker') {
        try {
          await supabase
            .from('workers')
            .upsert({
              id: user.id,
              trade,
              bio,
              experience_years: experience,
              hourly_rate: hourlyRate,
              radius_km: radiusKm,
              is_available: isAvailable,
              services_offered: servicesOffered,
            }, { onConflict: 'id' });
        } catch (wErr) {
          console.warn('Worker upsert notice:', wErr);
        }

        if (typeof window !== 'undefined') {
          try {
            const raw = localStorage.getItem('fixitnow_user');
            if (raw) {
              const u = JSON.parse(raw);
              const updatedUser = {
                ...u,
                user_metadata: {
                  ...u.user_metadata,
                  full_name: fullName,
                  phone,
                  city,
                  trade,
                  bio,
                  experience_years: experience,
                  hourly_rate: hourlyRate,
                  radius_km: radiusKm,
                  is_available: isAvailable,
                  services_offered: servicesOffered,
                  avatar_url: avatarUrl,
                }
              };
              localStorage.setItem('fixitnow_user', JSON.stringify(updatedUser));
              window.dispatchEvent(new Event('fixitnow_auth_change'));
            }
          } catch {}
        }
      }

      setSuccess('Profile & Service Settings saved successfully!');
    } catch (err: any) {
      console.error('Error saving profile details:', err);
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={`container ${styles.container}`}>
          <div className={styles.loadingState}>
            <div className="spinner spinner-lg" />
            <p>{t('profile.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  const initials = fullName?.split(' ').map((n) => n[0]).join('').toUpperCase() || '?';

  return (
    <div className={styles.page}>
      <div className={`container ${styles.container}`}>
        {/* Header */}
        <div className={styles.header}>
          <span className="section-tag"><SparklesIcon size={12} /> {t('profile.account_preferences')}</span>
          <h1 className="section-title">{t('profile.edit_profile')}</h1>
          <p className="section-subtitle">{t('profile.manage_subtitle')}</p>
        </div>

        <div className={styles.layout}>
          {/* Left Column: Sidebar Card */}
          <aside className={styles.sidebar}>
            <div className={styles.sidebarCard}>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />

              <div className={styles.avatarWrap}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt={fullName} className={styles.avatar} />
                ) : (
                  <div className={styles.avatarFallback}>{initials}</div>
                )}
                <button
                  type="button"
                  className={styles.avatarEditBtn}
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload profile picture"
                >
                  <CameraIcon size={16} />
                </button>
              </div>

              <div className={styles.avatarActions}>
                <button
                  type="button"
                  className={styles.uploadPhotoBtn}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <CameraIcon size={14} /> {t('profile.upload_photo')}
                </button>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '11px',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                  onClick={() => setShowAvatarInput(!showAvatarInput)}
                >
                  {showAvatarInput ? t('profile.hide_url') : t('profile.paste_url')}
                </button>
              </div>

              {showAvatarInput && (
                <div style={{ width: '100%', marginTop: '4px' }}>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://example.com/photo.jpg"
                    value={avatarUrl || ''}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    style={{ fontSize: '12px' }}
                  />
                </div>
              )}

              <div className={styles.summaryMeta}>
                <h2 className={styles.summaryName}>{fullName || 'User'}</h2>
                <span className={styles.summaryEmail}>{user?.email}</span>
                <div
                  className={styles.roleBadge}
                  style={{
                    background: role === 'worker' ? 'var(--primary-bg)' : 'var(--accent-bg)',
                    color: role === 'worker' ? 'var(--primary)' : 'var(--accent-dark)',
                  }}
                >
                  {role === 'worker' ? (
                    <><WrenchIcon size={14} /> {t('profile.service_provider')}</>
                  ) : (
                    <><UserIcon size={14} /> {t('profile.customer_account')}</>
                  )}
                </div>
              </div>

              <div className={styles.sidebarStats}>
                {joinedAt && (
                  <div className={styles.sidebarStat}>
                    <span>{t('profile.member_since')}</span>
                    <strong>{joinedAt}</strong>
                  </div>
                )}
                <div className={styles.sidebarStat}>
                  <span>{t('profile.gps_location')}</span>
                  <strong>{lat !== null && lng !== null ? t('profile.mapped') : t('profile.unmapped')}</strong>
                </div>
                {role === 'worker' && (
                  <>
                    <div className={styles.sidebarDivider} />
                    <div className={styles.sidebarStat}>
                      <span>{t('profile.selected_trade')}</span>
                      <strong>{TRADE_CONFIG[trade]?.label}</strong>
                    </div>
                    <div className={styles.sidebarStat}>
                      <span>{t('profile.hourly_rate')}</span>
                      <strong>₹{hourlyRate}/hr</strong>
                    </div>
                    <div className={styles.sidebarStat}>
                      <span>{t('profile.service_radius')}</span>
                      <strong>{radiusKm} km</strong>
                    </div>
                    <div className={styles.sidebarStat}>
                      <span>{t('profile.availability')}</span>
                      <strong>{isAvailable ? t('profile.online') : t('profile.offline')}</strong>
                    </div>
                  </>
                )}
              </div>
            </div>
          </aside>

          {/* Right Column: Form Fields */}
          <main className={styles.formArea}>
            {/* Category Navigation Tabs */}
            <div className={styles.tabsNav}>
              <button
                type="button"
                className={`${styles.tabItem} ${activeTab === 'account' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('account')}
              >
                <UserIcon size={14} /> {t('profile.personal_details')}
              </button>
              <button
                type="button"
                className={`${styles.tabItem} ${activeTab === 'location' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('location')}
              >
                <MapPinIcon size={14} /> {t('profile.location_area')}
              </button>
              {role === 'worker' && (
                <button
                  type="button"
                  className={`${styles.tabItem} ${activeTab === 'worker' ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab('worker')}
                >
                  <WrenchIcon size={14} /> {t('profile.service_profile')}
                </button>
              )}
            </div>

            {error && <div className="alert alert-error"><span>⚠️</span> {error}</div>}
            {success && <div className="alert alert-success"><span>✓</span> {success}</div>}

            <form onSubmit={handleSave} className={styles.form}>
              {/* Card 1: Account Settings */}
              {(activeTab === 'account' || activeTab === 'location' || activeTab === 'worker') && (
                <div className={styles.section} style={{ display: activeTab === 'account' ? 'flex' : 'none' }}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionIcon}>
                      <CheckBadgeIcon size={22} />
                    </div>
                    <div className={styles.sectionMeta}>
                      <h3 className={styles.sectionTitle}>{t('profile.account_details')}</h3>
                      <p className={styles.sectionDesc}>{t('profile.account_details_desc')}</p>
                    </div>
                  </div>

                  <div className={styles.formGrid}>
                    <div className="form-group">
                      <label className="form-label">{t('profile.full_name')}</label>
                      <input
                        type="text"
                        className="form-input"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={t('profile.full_name_placeholder')}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('profile.phone_number')}</label>
                      <input
                        type="tel"
                        className="form-input"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. +91 98765 43210"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Card 2: Location Settings */}
              {(activeTab === 'account' || activeTab === 'location' || activeTab === 'worker') && (
                <div className={styles.section} style={{ display: activeTab === 'location' ? 'flex' : 'none' }}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionIcon}>
                      <MapPinIcon size={22} />
                    </div>
                    <div className={styles.sectionMeta}>
                      <h3 className={styles.sectionTitle}>{t('profile.location_title')}</h3>
                      <p className={styles.sectionDesc}>{t('profile.location_desc')}</p>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('profile.city_label')}</label>
                    <input
                      type="text"
                      className="form-input"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder={t('profile.city_placeholder')}
                    />
                  </div>

                  <div className={styles.locationCard}>
                    <div className={styles.locationCardTop}>
                      <div className={styles.coordsBadgeGroup}>
                        <div className={styles.coordPill}>
                          <span className={styles.coordLabel}>Lat:</span>
                          <span>{lat !== null ? lat.toFixed(6) : 'Unset'}</span>
                        </div>
                        <div className={styles.coordPill}>
                          <span className={styles.coordLabel}>Lng:</span>
                          <span>{lng !== null ? lng.toFixed(6) : 'Unset'}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className={styles.detectLocBtn}
                        onClick={handleDetectLocation}
                        disabled={detectingLoc}
                      >
                        {detectingLoc ? (
                          <><span className="spinner" /> {t('profile.mapping_gps')}</>
                        ) : (
                          <><MapPinIcon size={14} /> {t('profile.auto_detect_gps')}</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Card 3: Worker Service Settings */}
              {role === 'worker' && (
                <div className={styles.section} style={{ display: activeTab === 'worker' ? 'flex' : 'none' }}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionIcon}>
                      <AwardIcon size={22} />
                    </div>
                    <div className={styles.sectionMeta}>
                      <h3 className={styles.sectionTitle}>{t('profile.service_settings_title')}</h3>
                      <p className={styles.sectionDesc}>{t('profile.service_settings_desc')}</p>
                    </div>
                  </div>

                  <div className={styles.formGrid}>
                    <div className="form-group">
                      <label className="form-label">{t('profile.select_trade')}</label>
                      <CustomSelect
                        options={TRADE_OPTIONS}
                        value={trade}
                        onChange={(val) => setTrade(val as TradeType)}
                        placeholder="Select trade..."
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">{t('profile.hourly_rate_label')}</label>
                      <input
                        type="number"
                        className="form-input"
                        value={hourlyRate}
                        onChange={(e) => setHourlyRate(Number(e.target.value))}
                        min="0"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">{t('profile.experience_label')}</label>
                      <input
                        type="number"
                        className="form-input"
                        value={experience}
                        onChange={(e) => setExperience(Number(e.target.value))}
                        min="0"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">{t('profile.radius_label')}</label>
                      <input
                        type="number"
                        className="form-input"
                        value={radiusKm}
                        onChange={(e) => setRadiusKm(Number(e.target.value))}
                        min="1"
                        required
                      />
                    </div>
                  </div>

                  <div className={styles.toggleCard}>
                    <div className={styles.toggleMeta}>
                      <span className={styles.toggleTitle}>{t('profile.availability_status')}</span>
                      <span className={styles.toggleSub}>{t('profile.availability_desc')}</span>
                    </div>

                    <label className={styles.toggleWrap}>
                      <input
                        type="checkbox"
                        checked={isAvailable}
                        onChange={(e) => setIsAvailable(e.target.checked)}
                        className={styles.toggleInput}
                      />
                      <span className={styles.toggleSlider} />
                    </label>
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('profile.bio_label')}</label>
                    <textarea
                      className="form-input"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder={t('profile.bio_placeholder')}
                      rows={4}
                    />
                  </div>

                  {/* Customized Services Offered Editor */}
                  <div className={styles.servicesEditorBlock}>
                    <div className={styles.servicesEditorTitle}>
                      <WrenchIcon size={18} style={{ color: 'var(--primary)', display: 'inline', marginRight: '6px', verticalAlign: '-2px' }} />
                      {t('profile.services_offered')} ({servicesOffered.length})
                    </div>
                    <div className={styles.servicesEditorSub}>
                      {t('profile.services_offered_desc')}
                    </div>

                    <div className={styles.serviceChecklistGrid}>
                      {(TRADE_SERVICES[trade] || TRADE_SERVICES.other).map((service, idx) => {
                        const isChecked = servicesOffered.includes(service);
                        return (
                          <div
                            key={idx}
                            className={`${styles.serviceCheckItem} ${isChecked ? styles.serviceCheckItemActive : ''}`}
                            onClick={() => {
                              const updated = isChecked
                                ? servicesOffered.filter((s) => s !== service)
                                : [...servicesOffered, service];
                              updateAndSaveServices(updated);
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              style={{ cursor: 'pointer' }}
                            />
                            <ServiceIcon service={service} trade={trade} size={18} />
                            <span>{service}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Additional Custom Services Added by Worker */}
                    {servicesOffered.filter(s => !(TRADE_SERVICES[trade] || TRADE_SERVICES.other).includes(s)).length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>{t('profile.additional_custom')}</div>
                        <div className={styles.serviceChecklistGrid}>
                          {servicesOffered.filter(s => !(TRADE_SERVICES[trade] || TRADE_SERVICES.other).includes(s)).map((service, idx) => (
                            <div
                              key={idx}
                              className={`${styles.serviceCheckItem} ${styles.serviceCheckItemActive}`}
                              onClick={() => {
                                const updated = servicesOffered.filter((s) => s !== service);
                                updateAndSaveServices(updated);
                              }}
                            >
                              <span>✕</span>
                              <ServiceIcon service={service} trade={trade} size={18} />
                              <span>{service}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add Custom Service Input */}
                    <div className={styles.customServiceAddWrap}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder={t('profile.add_custom_placeholder')}
                        value={customServiceInput}
                        onChange={(e) => setCustomServiceInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = customServiceInput.trim();
                            if (val && !servicesOffered.includes(val)) {
                              const updated = [...servicesOffered, val];
                              updateAndSaveServices(updated);
                              setCustomServiceInput('');
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          const val = customServiceInput.trim();
                          if (val && !servicesOffered.includes(val)) {
                            const updated = [...servicesOffered, val];
                            updateAndSaveServices(updated);
                            setCustomServiceInput('');
                          }
                        }}
                      >
                        {t('profile.add_service')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Action button */}
              <button
                type="submit"
                className="btn btn-primary btn-lg btn-full"
                style={{ marginTop: 'var(--space-2)' }}
                disabled={saving}
              >
                {saving ? (
                  <><span className="spinner" /> {t('profile.saving')}</>
                ) : (
                  t('profile.save_cta')
                )}
              </button>
            </form>
          </main>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className={styles.page}>
        <div className={`container ${styles.container}`}>
          <div className={styles.loadingState}>
            <div className="spinner spinner-lg" />
            <p>Loading...</p>
          </div>
        </div>
      </div>
    }>
      <ProfileForm />
    </Suspense>
  );
}
