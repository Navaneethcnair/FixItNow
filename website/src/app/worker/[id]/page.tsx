'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { TRADE_CONFIG, TradeType } from '@/lib/types';
import { StarIcon, MapPinIcon, CheckBadgeIcon, WrenchIcon, ServiceIcon, getTradeIcon } from '@/components/Icons';
import styles from './worker-profile.module.css';
import { useLanguage } from '@/context/LanguageContext';
import { savePortfolio, loadPortfolio } from '@/lib/portfolioStorage';

const TRADE_SERVICES: Record<string, string[]> = {
  plumber: ['Pipe Leak & Burst Repair', 'Tap, Faucet & Mixer Installation', 'Drain Unclogging & Cleaning', 'Water Heater / Geyser Service', 'Sanitary & Bathroom Fitting', 'Overhead Tank & Pump Maintenance'],
  electrician: ['Short Circuit & MCB Trip Repair', 'Full House Wiring & Diagnostics', 'Fan, Light & Chandelier Installation', 'Switchboard & Socket Replacement', 'Inverter & Battery Setup', 'Appliance Power Cord Repair'],
  carpenter: ['Door Lock, Latch & Hinge Replacement', 'Furniture Assembly & Repair', 'Modular Kitchen & Drawer Alignment', 'Custom Wooden Shelves & Cabinets', 'Window & Frame Polishing', 'Wood Scratch & Chip Restoration'],
  painter: ['Interior Wall & Ceiling Painting', 'Exterior Weatherproof Coating', 'Dampness & Waterproofing Treatment', 'Wall Putty & Primer Finishing', 'Texture & Accent Wall Design', 'Door & Window Enamel Painting'],
  ac_tech: ['Split & Window AC Servicing', 'Gas Leakage Check & Refilling', 'Cooling & Thermostat Fault Repair', 'AC Mounting & Dismantling', 'PCB Board Diagnostics', 'Drainage Pipe Unclogging'],
  welder: ['Metal Gate & Door Hinge Welding', 'Window Safety Grill Installation', 'Railing & Fence Repair', 'Structural Steel Welding', 'Custom Iron Frame Fabrication'],
  mason: ['Tile Fitting & Grouting Repair', 'Plastering & Wall Crack Filling', 'Concrete Floor & Step Touchups', 'Brickwork & Masonry Alteration', 'Waterproof Cementing'],
  other: ['General Handyman Repairs', 'Household Appliance Troubleshooting', 'Fixtures Mounting & Drilling', 'Minor Maintenance Jobs'],
};

// Compress uploaded image client-side to ~80KB JPEG so it never exceeds browser storage quotas
function compressImageClientSide(file: File, maxDim = 900, quality = 0.8): Promise<string> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            width = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve((e.target?.result as string) || '');
        }
      };
      img.onerror = () => resolve((e.target?.result as string) || '');
      img.src = (e.target?.result as string) || '';
    };
    reader.readAsDataURL(file);
  });
}

// Initial HD Trade Portfolio Projects with Multi-Image Support
const DEFAULT_PORTFOLIO: Record<string, any[]> = {
  painter: [
    {
      id: 'p1',
      title: 'Living Room Accent & Texture Wall',
      category: 'Interior Painting',
      duration: '2 Days',
      cost: '₹8,500',
      rating: '5.0 ★',
      image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80'
      ],
      desc: 'Full 3-coat wall putty preparation followed by Asian Paints Royale Emulsion with metallic accent texture design.'
    },
    {
      id: 'p2',
      title: 'Exterior Weatherproof Coating',
      category: 'Exterior Paint',
      duration: '4 Days',
      cost: '₹22,000',
      rating: '5.0 ★',
      image: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80'
      ],
      desc: 'High-pressure wash, crack filling sealant, and Apex Ultima weatherproof exterior painting.'
    },
    {
      id: 'p3',
      title: 'Dampness & Waterproofing Treatment',
      category: 'Waterproofing',
      duration: '1 Day',
      cost: '₹5,200',
      rating: '4.9 ★',
      image: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80'
      ],
      desc: 'SmartCare damp block coating applied on affected interior wall surfaces to prevent future flaking.'
    },
  ],
  plumber: [
    {
      id: 'pl1',
      title: 'Bathroom Fixture & Mixer Installation',
      category: 'Sanitary Fitting',
      duration: '1 Day',
      cost: '₹3,400',
      rating: '5.0 ★',
      image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1505798577917-a65157d3320a?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80'
      ],
      desc: 'Concealed diverter, Kohler mixer taps, and rain shower head installation with zero leaks.'
    },
    {
      id: 'pl2',
      title: 'Overhead Tank & Pump Maintenance',
      category: 'Pump Service',
      duration: '4 Hours',
      cost: '₹1,800',
      rating: '4.8 ★',
      image: 'https://images.unsplash.com/photo-1505798577917-a65157d3320a?auto=format&fit=crop&w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1505798577917-a65157d3320a?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80'
      ],
      desc: 'Cleaned 1000L overhead water tank and replaced faulty automatic water level controller sensor.'
    },
    {
      id: 'pl3',
      title: 'Kitchen Sink & Drain Pipe Unclogging',
      category: 'Drain Repair',
      duration: '2 Hours',
      cost: '₹950',
      rating: '5.0 ★',
      image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80'
      ],
      desc: 'Heavy-duty motorized drain auger snake used to clear deep grease clog in main kitchen drain.'
    },
  ],
  electrician: [
    {
      id: 'e1',
      title: 'Full 3BHK Concealed House Wiring',
      category: 'House Wiring',
      duration: '3 Days',
      cost: '₹18,000',
      rating: '5.0 ★',
      image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1517420704952-d9f39e95b43e?auto=format&fit=crop&w=800&q=80'
      ],
      desc: 'Complete Finolex copper flame-retardant wiring with Schneider MCB distribution box setup.'
    },
    {
      id: 'e2',
      title: 'Modular Switchboard & Socket Setup',
      category: 'Switchboard',
      duration: '1 Day',
      cost: '₹2,500',
      rating: '4.9 ★',
      image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80'
      ],
      desc: 'Replaced outdated switches with Legrand Arteor touch-friendly modular switchboards.'
    },
    {
      id: 'e3',
      title: 'Inverter & Heavy-Duty Battery Install',
      category: 'Power Backup',
      duration: '3 Hours',
      cost: '₹1,500',
      rating: '5.0 ★',
      image: 'https://images.unsplash.com/photo-1517420704952-d9f39e95b43e?auto=format&fit=crop&w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1517420704952-d9f39e95b43e?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80'
      ],
      desc: 'Microtek 1050VA pure sine wave inverter connected to main home distribution circuit.'
    },
  ],
  other: [
    {
      id: 'o1',
      title: 'Modular Kitchen Drawer Alignment',
      category: 'Carpentry',
      duration: '1 Day',
      cost: '₹3,200',
      rating: '5.0 ★',
      image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=800&q=80'
      ],
      desc: 'Hettich soft-close drawer channel replacement and cabinet door hinge adjustment.'
    },
    {
      id: 'o2',
      title: 'Split AC Deep Cleaning & Gas Topup',
      category: 'AC Servicing',
      duration: '3 Hours',
      cost: '₹2,100',
      rating: '4.9 ★',
      image: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80'
      ],
      desc: 'Foam jet wash of indoor cooling coil, outdoor condenser fin wash, and R32 gas refill.'
    },
    {
      id: 'o3',
      title: 'Safety Grill & Iron Gate Welding',
      category: 'Welding',
      duration: '1 Day',
      cost: '₹4,500',
      rating: '5.0 ★',
      image: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=800&q=80'
      ],
      desc: 'Arc welding repair for rusted balcony grill hinges and anti-rust primer coat.'
    },
  ]
};

const SKILL_TAGS: Record<string, string[]> = {
  plumber:     ['Pipe Fitting', 'Leak Detection', 'Drainage', 'Sanitary', 'Water Heater', 'Pump Repair'],
  electrician: ['Wiring', 'MCB/RCCB', 'Lighting', 'Switchboards', 'Inverter', 'Appliance Repair'],
  carpenter:   ['Furniture', 'Doors & Windows', 'Modular Kitchen', 'Polishing', 'Wood Work', 'Cabinets'],
  painter:     ['Interior Painting', 'Exterior Coating', 'Waterproofing', 'Texture Work', 'Putty', 'Enamel'],
  ac_tech:     ['AC Servicing', 'Gas Refill', 'Thermostat', 'PCB Repair', 'Mounting', 'Drainage'],
  welder:      ['Arc Welding', 'MIG/TIG', 'Iron Gates', 'Grills', 'Steel Fabrication', 'Railing'],
  mason:       ['Tiling', 'Plastering', 'Concrete', 'Brickwork', 'Waterproofing', 'Crack Filling'],
  other:       ['General Repairs', 'Handyman', 'Drilling', 'Fixture Mounting', 'Maintenance'],
};

function StarRatingBar({ rating, total }: { rating: number; total: number }) {
  const bars = [5, 4, 3, 2, 1];
  const mockDist: Record<number, number> = { 5: 0.72, 4: 0.18, 3: 0.06, 2: 0.03, 1: 0.01 };
  return (
    <div className={styles.ratingBars}>
      {bars.map(n => (
        <div key={n} className={styles.ratingBarRow}>
          <span style={{ width: 8, textAlign: 'right' }}>{n}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#fbbf24" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <div className={styles.ratingBarTrack}>
            <div className={styles.ratingBarFill} style={{ width: `${(mockDist[n] || 0) * 100}%` }} />
          </div>
          <span style={{ width: 28, fontSize: 10 }}>{Math.round((mockDist[n] || 0) * total)}</span>
        </div>
      ))}
    </div>
  );
}

export default function WorkerProfilePage() {
  const params = useParams();
  const workerId = params.id as string;
  const [worker, setWorker] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('guest');
  
  // Modals state
  const [activeProject, setActiveProject] = useState<any>(null);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  // Form State for Add / Edit
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newImages, setNewImages] = useState<string[]>([]);
  const [newUrlInput, setNewUrlInput] = useState('');
  const [newDuration, setNewDuration] = useState('1 Day');
  const [newCost, setNewCost] = useState('₹3,500');
  const [isCompressing, setIsCompressing] = useState(false);

  const supabase = createClient();
  const { t } = useLanguage();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        setUserRole(user.user_metadata?.role || user.role || 'customer');
      } else if (typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem('fixitnow_user');
          if (raw) {
            const u = JSON.parse(raw);
            setCurrentUser(u);
            setUserRole(u.user_metadata?.role || u.role || 'customer');
          }
        } catch {}
      }
    };
    checkAuth();
  }, [supabase]);

  useEffect(() => {
    const fetchData = async () => {
      let foundWorker: any = null;
      try {
        const { data: wRes } = await supabase.from('workers').select('*, profiles(*)').eq('id', workerId).single();
        if (wRes) foundWorker = { ...wRes, profiles: wRes.profiles || { full_name: 'Verified Worker', city: 'Mumbai' } };
      } catch {}

      if (!foundWorker) {
        try {
          const res = await fetch('/api/workers');
          const data = await res.json();
          foundWorker = (data.workers || []).find((w: any) => w.id === workerId);
        } catch {}
      }

      const isDemo = ['w1', 'w2', 'w16', 'w17', 'mock-w1', 'mock-w2'].includes(workerId);

      if (!foundWorker && typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem('fixitnow_user');
          if (raw) {
            const u = JSON.parse(raw);
            if (u.id === workerId || u.user_metadata?.role === 'worker' || u.role === 'worker') {
              foundWorker = {
                id: workerId || u.id,
                trade: u.user_metadata?.trade || u.trade || 'painter',
                bio: u.user_metadata?.bio || 'Certified blue-collar specialist providing prompt, reliable home repair services.',
                experience_years: u.user_metadata?.experience_years || 5,
                hourly_rate: u.user_metadata?.hourly_rate || 350,
                rating: isDemo ? 4.9 : 0,
                total_reviews: isDemo ? 18 : 0,
                is_available: u.user_metadata?.is_available ?? true,
                is_verified: true,
                radius_km: u.user_metadata?.radius_km || 15,
                profiles: {
                  full_name: u.user_metadata?.full_name || u.full_name || u.email?.split('@')[0] || 'Worker Specialist',
                  avatar_url: u.user_metadata?.avatar_url || null,
                  city: u.user_metadata?.city || u.city || 'Bengaluru',
                }
              };
            }
          }
        } catch {}
      }

      if (!foundWorker) {
        foundWorker = {
          id: workerId,
          trade: 'painter',
          bio: 'Interior and exterior painting professional. Texture work, waterproofing, and wall art specialist.',
          experience_years: 8,
          hourly_rate: 350,
          rating: isDemo ? 4.8 : 0,
          total_reviews: isDemo ? 84 : 0,
          is_available: true,
          is_verified: true,
          radius_km: 30,
          profiles: { full_name: 'Worker Specialist', avatar_url: null, city: 'Bengaluru' }
        };
      }

      setWorker(foundWorker);

      // Load Portfolio from Supabase / API endpoint (with local cache fallback)
      const tradeKey = (foundWorker.trade as TradeType) || 'painter';
      const initialItems = DEFAULT_PORTFOLIO[tradeKey] || DEFAULT_PORTFOLIO.other;

      try {
        const res = await fetch(`/api/portfolio?workerId=${workerId}`);
        const data = await res.json();

        if (data && Array.isArray(data.portfolio)) {
          setPortfolio(data.portfolio);
          savePortfolio(workerId, data.portfolio).catch(() => {});
        } else {
          const cached = await loadPortfolio(workerId);
          setPortfolio(cached !== null ? cached : initialItems);
        }
      } catch {
        const cached = await loadPortfolio(workerId);
        setPortfolio(cached !== null ? cached : initialItems);
      }

      try {
        const rRes = await fetch(`/api/reviews?workerId=${workerId}`);
        const rData = await rRes.json();
        if (rRes.ok && Array.isArray(rData.reviews)) {
          setReviews(rData.reviews);
          if (typeof rData.rating === 'number') {
            foundWorker.rating = rData.rating;
            foundWorker.total_reviews = rData.total_reviews;
          }
        } else {
          setReviews([]);
        }
      } catch {
        setReviews([]);
      }
      setLoading(false);
    };
    fetchData();
  }, [workerId, supabase]);

  // Real-time sync: listen for storage changes so the customer view updates immediately
  useEffect(() => {
    const storageKey = `fixitnow_portfolio_${workerId}`;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey) {
        loadPortfolio(workerId).then(data => {
          if (data !== null) setPortfolio(data);
        }).catch(() => {});
      }
    };

    const handlePortfolioEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.workerId === workerId && Array.isArray(detail?.portfolio)) {
        setPortfolio(detail.portfolio);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('portfolioUpdated', handlePortfolioEvent);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('portfolioUpdated', handlePortfolioEvent);
    };
  }, [workerId]);

  const savePortfolioToStorage = (updated: any[]) => {
    setPortfolio(updated);
    if (typeof window !== 'undefined') {
      // 1. Save to local browser cache (localStorage + sessionStorage + IndexedDB + memory)
      savePortfolio(workerId, updated).catch(() => {});

      // 2. Save to Supabase DB & Server Store so all browsers (Edge, Chrome, Brave, Safari) see changes
      fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId, portfolio: updated }),
      }).catch((err) => console.warn('Failed to sync portfolio to server:', err));

      // 3. Dispatch event so same-tab customer view updates instantly
      try {
        window.dispatchEvent(new CustomEvent('portfolioUpdated', {
          detail: { workerId, portfolio: updated }
        }));
      } catch {}
    }
  };

  const openAddModal = () => {
    setEditingProjectId(null);
    setNewTitle('');
    setNewCategory('');
    setNewDesc('');
    setNewImages([]);
    setNewUrlInput('');
    setNewDuration('1 Day');
    setNewCost('₹3,500');
    setIsAddModalOpen(true);
  };

  const openEditModal = (project: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingProjectId(project.id);
    setNewTitle(project.title || '');
    setNewCategory(project.category || '');
    setNewDesc(project.desc || '');
    const imgs = project.images && project.images.length > 0
      ? [...project.images]
      : (project.image ? [project.image] : []);
    setNewImages(imgs);
    setNewUrlInput('');
    setNewDuration(project.duration || '1 Day');
    setNewCost(project.cost || '₹3,500');
    setIsAddModalOpen(true);
  };

  const handleDeleteProject = (projectId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (typeof window !== 'undefined' && !window.confirm('Are you sure you want to delete this project from your work portfolio?')) {
      return;
    }
    const updated = portfolio.filter(p => p.id !== projectId);
    savePortfolioToStorage(updated);

    if (activeProject?.id === projectId) {
      setActiveProject(null);
    }
  };

  const handleMultipleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsCompressing(true);
    const files = Array.from(e.target.files);
    const newCompressed: string[] = [];

    for (const f of files) {
      try {
        const compressedData = await compressImageClientSide(f);
        if (compressedData) newCompressed.push(compressedData);
      } catch {}
    }

    if (newCompressed.length > 0) {
      setNewImages(prev => [...prev, ...newCompressed]);
    }
    setIsCompressing(false);
    e.target.value = '';
  };

  const handleAddImageUrl = () => {
    if (!newUrlInput.trim()) return;
    setNewImages(prev => [...prev, newUrlInput.trim()]);
    setNewUrlInput('');
  };

  const handleRemoveImage = (index: number) => {
    setNewImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSetCoverImage = (index: number) => {
    if (index === 0) return;
    setNewImages(prev => {
      const copy = [...prev];
      const selected = copy.splice(index, 1)[0];
      return [selected, ...copy];
    });
  };

  const handleSavePortfolio = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const defaultImg = 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80';
    const finalImages = newImages.length > 0 ? newImages : [defaultImg];
    const primaryImage = finalImages[0];

    const projectData = {
      id: editingProjectId || `custom-${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory.trim() || 'Custom Work',
      duration: newDuration.trim() || '1 Day',
      cost: newCost.trim() || '₹3,500',
      rating: editingProjectId ? (portfolio.find(p => p.id === editingProjectId)?.rating || '5.0 ★') : '5.0 ★',
      image: primaryImage,
      images: finalImages,
      desc: newDesc.trim() || 'Quality service completed with high precision and customer satisfaction.',
    };

    let updated: any[];
    if (editingProjectId) {
      updated = portfolio.map(p => p.id === editingProjectId ? projectData : p);
    } else {
      updated = [projectData, ...portfolio];
    }

    savePortfolioToStorage(updated);

    setIsAddModalOpen(false);
    setEditingProjectId(null);
  };

  if (loading) {
    return <div className={styles.page}><div className={styles.loadingWrap}><div className="spinner spinner-lg" /></div></div>;
  }

  if (!worker) {
    return (
      <div className={styles.page}>
        <div style={{ maxWidth: 600, margin: '120px auto', padding: '0 24px', textAlign: 'center' }}>
          <p style={{ marginBottom: 16, color: '#64748b' }}>{t('wp.worker_not_found')}</p>
          <Link href="/workers" className="btn btn-primary">{t('wp.browse_workers')}</Link>
        </div>
      </div>
    );
  }

  const tradeKey = (worker.trade as TradeType) || 'other';
  const trade = TRADE_CONFIG[tradeKey] || TRADE_CONFIG.other;
  const initials = worker.profiles?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || '?';
  const servicesList = worker.services_offered && Array.isArray(worker.services_offered) && worker.services_offered.length > 0
    ? worker.services_offered
    : (TRADE_SERVICES[tradeKey] || TRADE_SERVICES.other);
  const skills = SKILL_TAGS[tradeKey] || SKILL_TAGS.other;
  const firstName = worker.profiles?.full_name?.split(' ')[0] || 'Worker';
  const isDemo = ['w1', 'w2', 'w16', 'w17', 'mock-w1', 'mock-w2'].includes(worker.id);
  const totalReviews = reviews.length > 0 ? reviews.length : (typeof worker.total_reviews === 'number' && isDemo ? worker.total_reviews : (isDemo ? 84 : 0));
  const hasReviews = totalReviews > 0;
  const rating = hasReviews
    ? (reviews.length > 0 ? reviews.reduce((acc: number, r: any) => acc + (Number(r.rating) || 5), 0) / reviews.length : (Number(worker.rating) || (isDemo ? 4.8 : 0)))
    : 0;
  
  // STRICT OWNER CHECK: Only show worker editing tools if user is the actual worker
  const isOwn = currentUser?.id === worker.id || (userRole === 'worker' && currentUser?.id === worker.id);

  return (
    <div className={styles.page}>

      {/* ── COVER BANNER ─────────────────────────────────── */}
      <div className={styles.cover} />

      {/* ── WHITE HEADER SECTION ─────────────────────────── */}
      <div className={styles.headerSection}>
        <div className={styles.profileHeader}>
          <div className={styles.avatarWrap}>
            <div className={styles.avatarRing}>
              {worker.profiles?.avatar_url
                ? <img src={worker.profiles.avatar_url} alt={worker.profiles.full_name} />
                : initials}
            </div>
            {worker.is_available && <span className={styles.onlinePip} title="Available now" />}
          </div>

          <div className={styles.headerDetailsRow}>
            <div className={styles.avatarMeta}>
              <h1 className={styles.workerName}>{worker.profiles?.full_name || 'Worker'}</h1>
              <div className={styles.badgeRow}>
                {worker.is_verified && (
                  <span className={styles.verifiedBadge}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    {t('wp.govt_verified')}
                  </span>
                )}
                <span className={styles.tradeBadge} style={{ background: trade.bg, color: trade.color }}>
                  {getTradeIcon(worker.trade, 12)} {trade.label} {t('wp.specialist')}
                </span>
                {worker.is_available && (
                  <span className={styles.availBadge}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                    Available Now
                  </span>
                )}
              </div>
              <div className={styles.metaLine}>
                {worker.profiles?.city && (
                  <span className={styles.metaItem}>
                    <MapPinIcon size={13} style={{ color: '#94a3b8' }} />
                    {t('wp.serving')} {worker.profiles.city}
                  </span>
                )}
                <span className={styles.metaItem}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  Responds in &lt; 1 hr
                </span>
                <span className={styles.metaItem}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {worker.radius_km || 15} km radius
                </span>
              </div>
            </div>

            <div className={styles.headerRatingBadge}>
              <div className={styles.headerRatingTop}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#fbbf24" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                <span className={styles.headerRatingVal}>{hasReviews ? rating.toFixed(1) : 'New'}</span>
                <span className={styles.headerRatingCount}>({totalReviews} reviews)</span>
              </div>
              <div className={styles.headerExpLabel}>
                {worker.experience_years || 1}+ years experience
              </div>
            </div>
          </div>

          <div className={styles.statsCard}>
            <div className={styles.statCardItem}>
              <div className={styles.statBarVal}>
                <StarIcon size={15} style={{ color: '#fbbf24' }} />
                {hasReviews ? rating.toFixed(1) : 'New'}
              </div>
              <div className={styles.statBarLabel}>Rating</div>
            </div>
            <div className={styles.statCardItem}>
              <div className={styles.statBarVal}>{totalReviews}</div>
              <div className={styles.statBarLabel}>Reviews</div>
            </div>
            <div className={styles.statCardItem}>
              <div className={styles.statBarVal}>{worker.experience_years || 5}+</div>
              <div className={styles.statBarLabel}>Years Exp.</div>
            </div>
            <div className={styles.statCardItem}>
              <div className={styles.statBarVal}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                100%
              </div>
              <div className={styles.statBarLabel}>Job Success</div>
            </div>
            <div className={styles.statCardItem}>
              <div className={styles.statBarVal}>&lt;1hr</div>
              <div className={styles.statBarLabel}>Response</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BODY LAYOUT ──────────────────────────────────── */}
      <div className={styles.bodyLayout}>

        {/* MAIN COLUMN */}
        <div className={styles.mainCol}>

          {/* ABOUT */}
          {worker.bio && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                <span className={styles.cardTitleIcon}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </span>
                About {firstName}
              </h2>
              <p className={styles.bioText}>{worker.bio}</p>
            </div>
          )}

          {/* SKILLS */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              <span className={styles.cardTitleIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              </span>
              Skills & Expertise
            </h2>
            <div className={styles.skillsWrap}>
              {skills.map((s, i) => (
                <span key={i} className={styles.skillTag}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* SERVICES OFFERED */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              <span className={styles.cardTitleIcon}>
                <WrenchIcon size={16} style={{ color: '#4f46e5' }} />
              </span>
              {t('wp.services_offered').replace('{count}', String(servicesList.length))}
            </h2>
            <div className={styles.servicesGrid}>
              {servicesList.map((service: string, idx: number) => (
                <div key={idx} className={styles.serviceItem}>
                  <ServiceIcon service={service} trade={tradeKey} />
                  <span>{service}</span>
                </div>
              ))}
            </div>
          </div>

          {/* WORK PORTFOLIO (WITH REAL PHOTOGRAPHY + EDIT/DELETE + MULTI-IMAGE CAROUSEL) */}
          <div className={styles.card}>
            <div className={styles.cardHeaderFlex}>
              <h2 className={styles.cardTitle}>
                <span className={styles.cardTitleIcon}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </span>
                Work Portfolio ({portfolio.length})
              </h2>

              {/* STRICT WORKER ONLY BUTTON - Never shown to customers */}
              {isOwn && (
                <button className={styles.addPortfolioBtn} onClick={openAddModal}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add Project
                </button>
              )}
            </div>

            <div className={styles.portfolioGrid}>
              {portfolio.map((item) => {
                const itemImages = item.images && item.images.length > 0
                  ? item.images
                  : [item.image || 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80'];
                const coverPhoto = itemImages[0];

                return (
                  <div
                    key={item.id}
                    className={styles.portfolioItem}
                    onClick={() => {
                      setActiveProject(item);
                      setActiveImageIndex(0);
                    }}
                  >
                    {/* Cover Photography */}
                    <img
                      src={coverPhoto}
                      alt={item.title}
                      className={styles.portfolioImg}
                    />

                    {/* Worker Action Bar (Edit / Delete) */}
                    {isOwn && (
                      <div className={styles.portfolioCardActions} onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          className={styles.cardActionEditBtn}
                          onClick={(e) => openEditModal(item, e)}
                          title="Edit project"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          className={styles.cardActionDeleteBtn}
                          onClick={(e) => handleDeleteProject(item.id, e)}
                          title="Delete project"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    )}

                    {/* Multiple Images Badge */}
                    {itemImages.length > 1 && (
                      <span className={styles.photoCountBadge}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        {itemImages.length} Photos
                      </span>
                    )}

                    {/* SVG Badge Overlay */}
                    <div className={styles.portfolioBadgeSvg}>
                      {getTradeIcon(worker.trade, 16)}
                    </div>

                    <div className={styles.portfolioOverlay}>
                      <span className={styles.viewBadge}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        Watch Work
                      </span>
                      <div className={styles.portfolioItemTitle}>{item.title}</div>
                      <div className={styles.portfolioItemSub}>
                        <span>{item.category}</span>
                        <span style={{ color: '#fbbf24', fontWeight: 800 }}>{item.cost || '₹3,500'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* TRUST & VERIFICATION */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              <span className={styles.cardTitleIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
              </span>
              {t('wp.trust_verification')}
            </h2>
            <div className={styles.trustGrid}>
              {[
                { bg: 'rgba(16,185,129,0.07)', bc: 'rgba(16,185,129,0.18)', stroke: '#10b981', color: '#065f46', text: t('wp.bg_checked'), icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/> },
                { bg: 'rgba(79,70,229,0.07)', bc: 'rgba(79,70,229,0.18)', stroke: '#4f46e5', color: '#3730a3', text: t('wp.fast_dispatch'), icon: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/> },
                { bg: 'rgba(14,165,233,0.07)', bc: 'rgba(14,165,233,0.18)', stroke: '#0ea5e9', color: '#0369a1', text: t('wp.working_hours'), icon: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></> },
                { bg: 'rgba(245,158,11,0.07)', bc: 'rgba(245,158,11,0.18)', stroke: '#f59e0b', color: '#78350f', text: t('wp.no_hidden_fees'), icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></> },
              ].map((item, i) => (
                <div key={i} className={styles.trustItem} style={{ background: item.bg, borderColor: item.bc }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={item.stroke} strokeWidth="2.5" style={{ flexShrink: 0 }}>{item.icon}</svg>
                  <span style={{ color: item.color, fontWeight: 750 }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SERVICE GUARANTEE */}
          <div className={styles.guarantee}>
            <div className={styles.guaranteeIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
              </svg>
            </div>
            <div>
              <h4>{t('wp.guarantee_title')}</h4>
              <p>{t('wp.guarantee_desc')}</p>
            </div>
          </div>

          {/* REVIEWS */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              <span className={styles.cardTitleIcon}>
                <StarIcon size={16} style={{ color: '#fbbf24' }} />
              </span>
              {t('wp.customer_reviews').replace('{count}', String(reviews.length))}
            </h2>

            {reviews.length > 0 && (
              <div className={styles.ratingOverview}>
                <div className={styles.bigRating}>
                  <div className={styles.bigRatingNum}>{rating.toFixed(1)}</div>
                  <div className={styles.bigRatingStars}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <StarIcon key={i} size={14} filled={i < Math.round(rating)} />
                    ))}
                  </div>
                  <div className={styles.bigRatingCount}>{totalReviews} reviews</div>
                </div>
                <StarRatingBar rating={rating} total={totalReviews} />
              </div>
            )}

            {reviews.length > 0 ? (
              <div className={styles.reviewList}>
                {reviews.map(r => (
                  <div key={r.id} className={styles.reviewCard}>
                    <div className={styles.reviewHeader}>
                      <div className={styles.reviewerWrap}>
                        <div className={styles.reviewerAvatar}>
                          {(r.profiles?.full_name || 'C')[0].toUpperCase()}
                        </div>
                        <div>
                          <div className={styles.reviewerName}>{r.profiles?.full_name || 'Customer'}</div>
                          <div className={styles.reviewDate}>
                            {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      </div>
                      <div className={styles.reviewStars}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <StarIcon key={i} size={14} filled={i < r.rating} />
                        ))}
                      </div>
                    </div>
                    {r.comment && <p className={styles.reviewText}>&ldquo;{r.comment}&rdquo;</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.noReviews}>{t('wp.no_reviews')}</p>
            )}
          </div>

        </div>

        {/* RIGHT SIDEBAR */}
        <aside className={styles.sidebarCol}>
          {isOwn ? (
            <div className={styles.bookingCard}>
              <div className={styles.bookingCardTop}>
                <div className={styles.bookingRate}>₹{worker.hourly_rate}</div>
                <div className={styles.bookingRateLabel}>{t('wp.per_hour')}</div>
                <div className={styles.bookingRateNote}>Public View Mode</div>
              </div>
              <div className={styles.bookingCardBody}>
                <div className={styles.ownBanner}>
                  <div className={styles.ownBannerTag}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    {t('wp.public_preview')}
                  </div>
                  <p className={styles.ownBannerNote}>{t('wp.how_others_view')}</p>
                  <Link href="/profile?tab=worker" className={styles.editBtn}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    {t('wp.edit_profile')}
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.bookingCard}>
              <div className={styles.bookingCardTop}>
                <div className={styles.bookingRate}>₹{worker.hourly_rate}</div>
                <div className={styles.bookingRateLabel}>{t('wp.per_hour')}</div>
                <div className={styles.bookingRateNote}>No booking fee · Pay after service</div>
              </div>
              <div className={styles.bookingCardBody}>
                <div className={styles.bookingFeatures}>
                  {[
                    { icon: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>, text: 'Available Today' },
                    { icon: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></>, text: 'Background Verified' },
                    { icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>, text: 'No Hidden Charges' },
                    { icon: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>, text: 'Fast Dispatch (<30 min)' },
                  ].map((feat, i) => (
                    <div key={i} className={styles.bookingFeature}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.2" style={{ flexShrink: 0 }}>{feat.icon}</svg>
                      {feat.text}
                    </div>
                  ))}
                </div>

                <Link href={`/book/new?workerId=${worker.id}`} className={styles.bookBtn}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  {t('wp.book_now').replace('{name}', firstName)}
                </Link>

                <div className={styles.orDivider}>or</div>

                <button className={styles.msgBtn}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  Message {firstName}
                </button>

                <div className={styles.safeBadge}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  FixItNow Protected Booking
                </div>
              </div>
            </div>
          )}

          <div className={styles.infoCard}>
            <div className={styles.infoCardTitle}>Worker Details</div>
            {[
              { label: 'Trade', val: `${trade.label} ${t('wp.specialist')}` },
              { label: 'Location', val: `${t('wp.serving')} ${worker.profiles?.city || 'Mumbai'}` },
              { label: 'Experience', val: `${worker.experience_years || 5} years` },
              { label: 'Service Area', val: `${worker.radius_km || 15} km radius` },
              { label: 'Member Since', val: '2023' },
              { label: 'Languages', val: 'Hindi, English' },
            ].map((row, i) => (
              <div key={i} className={styles.infoRow}>
                <span className={styles.infoLabel}>{row.label}</span>
                <span className={styles.infoVal}>{row.val}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* ── PORTFOLIO WATCH LIGHTBOX MODAL WITH MULTI-IMAGE CAROUSEL ────────────────── */}
      {activeProject && (() => {
        const activeImages = activeProject.images && activeProject.images.length > 0
          ? activeProject.images
          : [activeProject.image || 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80'];
        const safeImgIndex = Math.min(activeImageIndex, activeImages.length - 1);
        const currentHeroImg = activeImages[safeImgIndex];

        return (
          <div className={styles.modalBackdrop} onClick={() => setActiveProject(null)}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
              <button className={styles.modalCloseBtn} onClick={() => setActiveProject(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>

              {/* Multi-Image Hero Visual Carousel */}
              <div className={styles.modalHeroVisual}>
                <img
                  src={currentHeroImg}
                  alt={`${activeProject.title} - Photo ${safeImgIndex + 1}`}
                />

                {/* Photo Counter Pill */}
                {activeImages.length > 1 && (
                  <div className={styles.carouselCounter}>
                    📷 Photo {safeImgIndex + 1} of {activeImages.length}
                  </div>
                )}

                {/* Previous / Next Navigation Arrows */}
                {activeImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      className={styles.carouselArrowPrev}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveImageIndex(prev => prev === 0 ? activeImages.length - 1 : prev - 1);
                      }}
                      title="Previous photo"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className={styles.carouselArrowNext}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveImageIndex(prev => prev === activeImages.length - 1 ? 0 : prev + 1);
                      }}
                      title="Next photo"
                    >
                      ›
                    </button>
                  </>
                )}
              </div>

              {/* Interactive Thumbnail Gallery Strip */}
              {activeImages.length > 1 && (
                <div className={styles.thumbnailBar}>
                  {activeImages.map((imgUrl: string, idx: number) => (
                    <button
                      key={idx}
                      type="button"
                      className={`${styles.thumbItem} ${idx === safeImgIndex ? styles.thumbActive : ''}`}
                      onClick={() => setActiveImageIndex(idx)}
                    >
                      <img src={imgUrl} alt={`Thumbnail ${idx + 1}`} />
                    </button>
                  ))}
                </div>
              )}

              <div className={styles.modalBody}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className={styles.modalTag}>{activeProject.category || trade.label}</span>
                  {isOwn && (
                    <button
                      type="button"
                      className={styles.editInModalBtn}
                      onClick={(e) => {
                        const proj = activeProject;
                        setActiveProject(null);
                        openEditModal(proj, e);
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                      Edit Project
                    </button>
                  )}
                </div>

                <h3 className={styles.modalTitle}>{activeProject.title}</h3>
                <p className={styles.modalDesc}>{activeProject.desc}</p>

                <div className={styles.modalSpecsGrid}>
                  <div className={styles.specItem}>
                    <div className={styles.specVal}>{activeProject.duration || '1 Day'}</div>
                    <div className={styles.specLabel}>Duration</div>
                  </div>
                  <div className={styles.specItem}>
                    <div className={styles.specVal}>{activeProject.cost || '₹3,500'}</div>
                    <div className={styles.specLabel}>Est. Cost</div>
                  </div>
                  <div className={styles.specItem}>
                    <div className={styles.specVal}>{activeProject.rating || '5.0 ★'}</div>
                    <div className={styles.specLabel}>Client Rating</div>
                  </div>
                </div>

                {!isOwn && (
                  <Link href={`/book/new?workerId=${worker.id}`} className={styles.bookBtn} onClick={() => setActiveProject(null)}>
                    Book Similar Service with {firstName} →
                  </Link>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── WORKER ADD / EDIT PORTFOLIO MODAL (WITH MULTI-IMAGE UPLOADER) ────────────────────── */}
      {isAddModalOpen && isOwn && (
        <div className={styles.modalBackdrop} onClick={() => setIsAddModalOpen(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <button className={styles.modalCloseBtn} onClick={() => setIsAddModalOpen(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>

            <div className={styles.modalBody}>
              <h3 className={styles.modalTitle} style={{ marginBottom: 4 }}>
                {editingProjectId ? 'Edit Work Portfolio Project' : 'Add Work Portfolio Item'}
              </h3>
              <p className={styles.modalDesc} style={{ marginBottom: 20 }}>
                {editingProjectId ? 'Update your project details and photo gallery.' : 'Showcase your best completed work projects with multiple photos to get 3x more bookings!'}
              </p>

              <form onSubmit={handleSavePortfolio}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Project Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 3BHK Living Room Wall Paint & Texture Design"
                    className={styles.formInput}
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Category</label>
                  <select
                    className={styles.formSelect}
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                  >
                    <option value="">Select category...</option>
                    {servicesList.map((s: string, i: number) => (
                      <option key={i} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* MULTIPLE IMAGE UPLOADER & GALLERY MANAGER */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    Project Photos ({newImages.length} attached)
                  </label>
                  
                  {/* File Upload Selector */}
                  <div className={styles.imageUploadBox}>
                    <label className={styles.uploadDropArea}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.2">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                      <span>{isCompressing ? 'Processing photos...' : '+ Upload Multiple Photos from Device'}</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleMultipleFiles}
                        className={styles.hiddenFileInput}
                        disabled={isCompressing}
                      />
                    </label>

                    {/* URL Add input */}
                    <div className={styles.urlInputRow}>
                      <input
                        type="url"
                        placeholder="Or paste image URL (https://...)"
                        className={styles.formInput}
                        value={newUrlInput}
                        onChange={e => setNewUrlInput(e.target.value)}
                      />
                      <button
                        type="button"
                        className={styles.addUrlBtn}
                        onClick={handleAddImageUrl}
                      >
                        Add URL
                      </button>
                    </div>
                  </div>

                  {/* Attached Thumbnails Preview Bar */}
                  {newImages.length > 0 && (
                    <div className={styles.attachedThumbsGrid}>
                      {newImages.map((imgUrl, idx) => (
                        <div key={idx} className={styles.attachedThumbCard}>
                          <img src={imgUrl} alt={`Uploaded photo ${idx + 1}`} />
                          {idx === 0 ? (
                            <span className={styles.coverBadge}>Cover</span>
                          ) : (
                            <button
                              type="button"
                              className={styles.setCoverBtn}
                              onClick={() => handleSetCoverImage(idx)}
                              title="Make primary cover photo"
                            >
                              Make Cover
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.removeThumbBtn}
                            onClick={() => handleRemoveImage(idx)}
                            title="Remove image"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Duration</label>
                    <input
                      type="text"
                      placeholder="e.g. 2 Days"
                      className={styles.formInput}
                      value={newDuration}
                      onChange={e => setNewDuration(e.target.value)}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Total Cost / Rate</label>
                    <input
                      type="text"
                      placeholder="e.g. ₹5,000"
                      className={styles.formInput}
                      value={newCost}
                      onChange={e => setNewCost(e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Project Description</label>
                  <textarea
                    placeholder="Describe the materials used, challenge solved, or special finish..."
                    className={styles.formTextarea}
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                  />
                </div>

                <div className={styles.formActionsRow}>
                  {editingProjectId && (
                    <button
                      type="button"
                      className={styles.deleteProjectInModalBtn}
                      onClick={(e) => handleDeleteProject(editingProjectId, e)}
                    >
                      Delete Project
                    </button>
                  )}
                  <button type="submit" className={styles.submitProjectBtn} disabled={isCompressing}>
                    {editingProjectId ? 'Save Changes' : '+ Add Project to Portfolio'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
