import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mockProfiles, mockWorkers } from '@/lib/jobStore';
import { createUser, userExists } from '@/lib/userStore';

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !!url && !url.includes('YOUR_PROJECT_REF');
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next');
  const roleParam = requestUrl.searchParams.get('role');
  const errorParam = requestUrl.searchParams.get('error_description') || requestUrl.searchParams.get('error');

  let origin = requestUrl.origin;
  const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (origin.includes('0.0.0.0')) {
    if (hostHeader && !hostHeader.includes('0.0.0.0')) {
      const proto = request.headers.get('x-forwarded-proto') || requestUrl.protocol.replace(':', '') || 'http';
      origin = `${proto}://${hostHeader}`;
    } else {
      origin = `${requestUrl.protocol}//localhost:${requestUrl.port || 3000}`;
    }
  }

  if (errorParam) {
    console.error('OAuth Callback Error:', errorParam);
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(errorParam)}`);
  }

  if (code) {
    // 1. Mock / Local Mode (when Supabase is not configured or mock code is returned)
    if (!isSupabaseConfigured() || code === 'mock_google_code') {
      const role = roleParam || (next?.includes('worker') ? 'worker' : 'customer');
      const emailQuery = requestUrl.searchParams.get('email');
      const nameQuery = requestUrl.searchParams.get('name');

      const mockEmail = (emailQuery && emailQuery.trim()) ? emailQuery.trim().toLowerCase() : (role === 'worker' ? 'worker.google@example.com' : 'google.user@example.com');

      const computedNameFromEmail = mockEmail.split('@')[0].split(/[._-]/).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
      const mockName = (nameQuery && nameQuery.trim()) ? nameQuery.trim() : (computedNameFromEmail || (role === 'worker' ? 'Rajesh Kumar' : 'Google User'));

      const mockUserId = `google-${mockEmail.replace(/[^a-zA-Z0-9]/g, '-')}`;

      const mockUser = {
        id: mockUserId,
        email: mockEmail,
        user_metadata: {
          full_name: mockName,
          role: role,
          avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
        },
      };

      // Seed local user store if missing
      if (!userExists(mockEmail)) {
        createUser({
          id: mockUserId,
          email: mockEmail,
          password: 'google_oauth_mock_password',
          full_name: mockName,
          role: role,
          phone: '+91 98765 11111',
        });
      }

      // Ensure mock profile exists
      if (!mockProfiles.has(mockUserId)) {
        mockProfiles.set(mockUserId, {
          id: mockUserId,
          full_name: mockName,
          phone: '+91 98765 11111',
          avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
          role: role as any,
          city: 'Mumbai',
          location_lat: 19.076,
          location_lng: 72.8777,
          created_at: new Date().toISOString(),
        });
      }

      // Ensure mock worker exists if role is worker
      if (role === 'worker' && !mockWorkers.has(mockUserId)) {
        mockWorkers.set(mockUserId, {
          id: mockUserId,
          trade: 'plumber',
          bio: 'Google authenticated worker specialist.',
          experience_years: 5,
          hourly_rate: 350,
          rating: 4.9,
          total_reviews: 15,
          is_available: true,
          is_verified: true,
          radius_km: 20,
        });
      }

      const targetPath = next || (role === 'worker' ? '/worker-dashboard' : '/upload');
      const response = NextResponse.redirect(`${origin}${targetPath}`);

      response.cookies.set('fixitnow_pending_oauth', JSON.stringify(mockUser), {
        path: '/',
        maxAge: 60,
      });

      return response;
    }

    // 2. Real Supabase Auth Mode
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('Supabase exchangeCodeForSession error:', error);
        return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error.message)}`);
      }

      if (data?.user) {
        const user = data.user;
        
        // Fetch existing user profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        let role = profile?.role || roleParam || user.user_metadata?.role;
        if (!role) {
          role = next?.includes('worker') ? 'worker' : 'customer';
        }

        // If profile does not exist yet, create it
        if (!profile) {
          await supabase.from('profiles').insert({
            id: user.id,
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Google User',
            role: role,
            avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
          });

          if (role === 'worker') {
            await supabase.from('workers').insert({
              id: user.id,
              trade: 'other',
              experience_years: 0,
              hourly_rate: 0,
              rating: 5.0,
              total_reviews: 0,
              is_available: true,
              is_verified: false,
              radius_km: 20,
            });
          }
        }

        const targetPath = next || (role === 'worker' ? '/worker-dashboard' : '/upload');
        return NextResponse.redirect(`${origin}${targetPath}`);
      }
    } catch (err: any) {
      console.error('Auth callback processing error:', err);
      return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(err?.message || 'Authentication failed')}`);
    }
  }

  // Fallback if no code is provided
  return NextResponse.redirect(`${origin}/auth/login`);
}