import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, mockWorkers, mockProfiles } from '@/lib/jobStore';
import { getAllUsers } from '@/lib/userStore';

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawTrade = searchParams.get('trade');
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    // Normalize trade query
    let targetTrade = rawTrade;
    if (rawTrade === 'general_repair' || rawTrade === 'appliance_repair' || rawTrade === 'electronics') {
      targetTrade = 'other';
    }

    let allWorkersList: any[] = [];

    // 1. Fetch persistent registered worker accounts from userStore (.local-users.json)
    const registeredUsers = getAllUsers();
    const registeredWorkers = registeredUsers
      .filter((u: any) => u.role === 'worker')
      .map((u: any) => {
        const wInfo = mockWorkers.get(u.id);
        const pInfo = mockProfiles.get(u.id);
        const isDemo = ['w1', 'w2', 'w16', 'w17', 'mock-w1', 'mock-w2'].includes(u.id);

        return {
          id: u.id,
          trade: wInfo?.trade || u.trade || 'other',
          bio: wInfo?.bio || u.bio || 'Certified repair specialist offering prompt, reliable home service.',
          experience_years: wInfo?.experience_years ?? (u.experience_years || 1),
          hourly_rate: wInfo?.hourly_rate ?? (u.hourly_rate || 350),
          rating: wInfo?.rating ?? (isDemo ? 4.8 : 0),
          total_reviews: wInfo?.total_reviews ?? (isDemo ? 84 : 0),
          is_available: wInfo?.is_available ?? true,
          is_verified: wInfo?.is_verified ?? true,
          radius_km: wInfo?.radius_km ?? 20,
          is_new_account: !isDemo,
          profiles: {
            full_name: u.full_name || pInfo?.full_name || u.email.split('@')[0],
            avatar_url: pInfo?.avatar_url || u.avatar_url || null,
            city: pInfo?.city || u.city || 'Bengaluru',
            location_lat: pInfo?.location_lat || u.location_lat || 12.9716,
            location_lng: pInfo?.location_lng || u.location_lng || 77.5946,
          }
        };
      });

    // 2. Fetch DB Workers from Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        const { createClient } = await import('@/lib/supabase/server');
        const supabase = await createClient();
        const { data: dbData } = await supabase
          .from('workers')
          .select('*, profiles(full_name, avatar_url, city, location_lat, location_lng)');
        if (dbData && dbData.length > 0) {
          allWorkersList = dbData;
        }
      } catch {}
    }

    // Merge registered workers + in-memory mock workers
    const existingIds = new Set(allWorkersList.map((w: any) => w.id));

    // Add registered user workers FIRST (so newly created accounts appear at the top!)
    registeredWorkers.forEach((rw) => {
      if (!existingIds.has(rw.id)) {
        allWorkersList.unshift(rw);
        existingIds.add(rw.id);
      }
    });

    // Add remaining mock workers
    Array.from(mockWorkers.values()).forEach((w) => {
      if (!existingIds.has(w.id)) {
        const p = mockProfiles.get(w.id) || { full_name: 'Verified Repair Specialist', city: 'Mumbai' };
        allWorkersList.push({
          ...w,
          profiles: p
        });
        existingIds.add(w.id);
      }
    });

    // 3. Filter by trade if requested
    let result = allWorkersList;
    if (targetTrade) {
      let filtered = result.filter(w => w.trade === targetTrade || w.trade === 'other');
      if (filtered.length > 0) {
        result = filtered;
      }
    }

    // 4. Calculate distance & sort with new accounts prioritized
    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      result = result.map((w: any) => {
        const index = parseInt((w.id || '5').replace(/\D/g, '') || '5');
        const mockLat = w.profiles?.location_lat ?? (userLat + ((index % 5 - 2) * 0.02));
        const mockLng = w.profiles?.location_lng ?? (userLng + ((index % 3 - 1) * 0.02));
        const dist = getDistanceKm(userLat, userLng, mockLat, mockLng);
        return {
          ...w,
          distance_km: Math.round(dist * 10) / 10,
        };
      }).sort((a: any, b: any) => {
        if (a.is_new_account && !b.is_new_account) return -1;
        if (!a.is_new_account && b.is_new_account) return 1;
        return (a.distance_km || 0) - (b.distance_km || 0);
      });
    } else {
      result = result.map((w: any) => ({
        ...w,
        distance_km: Math.round((Math.random() * 5 + 1) * 10) / 10,
      })).sort((a: any, b: any) => {
        if (a.is_new_account && !b.is_new_account) return -1;
        if (!a.is_new_account && b.is_new_account) return 1;
        return 0;
      });
    }

    return NextResponse.json({ workers: result });
  } catch (error: any) {
    console.error('Workers route error:', error);
    return NextResponse.json({ error: 'Failed to fetch workers' }, { status: 500 });
  }
}
