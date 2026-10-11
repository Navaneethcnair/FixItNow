import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, addReview, getReviewsForWorker } from '@/lib/jobStore';

const DEMO_WORKER_IDS = ['w1', 'w2', 'w16', 'w17', 'mock-w1', 'mock-w2'];

const DEMO_REVIEWS = [
  {
    id: 'demo-1',
    rating: 5,
    comment: 'Highly recommended! Arrived on time, identified the problem instantly, and completed a clean job.',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    profiles: { full_name: 'Priya Mehta' }
  },
  {
    id: 'demo-2',
    rating: 5,
    comment: 'Professional service at a very reasonable rate. Cleaned up afterwards. Will book again!',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    profiles: { full_name: 'Arjun Singh' }
  },
  {
    id: 'demo-3',
    rating: 4,
    comment: 'Great work overall. Completed the job quickly with no mess left behind.',
    created_at: new Date(Date.now() - 86400000 * 9).toISOString(),
    profiles: { full_name: 'Sneha Patel' }
  }
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workerId = searchParams.get('workerId');

    if (!workerId) {
      return NextResponse.json({ error: 'workerId parameter is required' }, { status: 400 });
    }

    let reviewsList: any[] = [];

    if (isSupabaseConfigured()) {
      const { createClient } = await import('@/lib/supabase/server');
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('reviews')
        .select('*, profiles(full_name)')
        .eq('worker_id', workerId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        reviewsList = data;
      }
    }

    if (reviewsList.length === 0) {
      reviewsList = getReviewsForWorker(workerId);
    }

    // Demo Accounts: Return demo feedback values if no real reviews are posted yet
    const isDemo = DEMO_WORKER_IDS.includes(workerId);
    if (reviewsList.length === 0 && isDemo) {
      reviewsList = DEMO_REVIEWS;
    }

    // Calculate real-time dynamic rating & review count
    const totalReviews = reviewsList.length;
    const avgRating = totalReviews > 0
      ? Math.round((reviewsList.reduce((acc: number, r: any) => acc + (Number(r.rating) || 5), 0) / totalReviews) * 10) / 10
      : (isDemo ? 4.8 : 0);

    return NextResponse.json({
      reviews: reviewsList,
      rating: avgRating,
      total_reviews: totalReviews,
      is_demo_account: isDemo && reviewsList === DEMO_REVIEWS
    });
  } catch (error: any) {
    console.error('Fetch reviews error:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { worker_id, customer_id, rating, comment, booking_id } = await request.json();

    if (!worker_id || !rating) {
      return NextResponse.json({ error: 'worker_id and rating are required' }, { status: 400 });
    }

    let newReview: any = null;

    if (isSupabaseConfigured()) {
      try {
        const { createClient } = await import('@/lib/supabase/server');
        const supabase = await createClient();

        const { data: rev, error } = await supabase
          .from('reviews')
          .insert([{
            worker_id,
            customer_id: customer_id || 'local-user',
            booking_id: booking_id || null,
            rating: Number(rating),
            comment: comment || null,
          }])
          .select('*, profiles(full_name)')
          .single();

        if (!error && rev) {
          newReview = rev;

          // Re-calculate worker average rating in Supabase
          const { data: allRevs } = await supabase.from('reviews').select('rating').eq('worker_id', worker_id);
          if (allRevs && allRevs.length > 0) {
            const avg = allRevs.reduce((acc: number, r: any) => acc + (Number(r.rating) || 5), 0) / allRevs.length;
            await supabase.from('workers').update({
              rating: Math.round(avg * 10) / 10,
              total_reviews: allRevs.length,
            }).eq('id', worker_id);
          }
        }
      } catch (dbErr) {
        console.warn('Supabase DB review insert error:', dbErr);
      }
    }

    if (!newReview) {
      newReview = addReview({
        worker_id,
        customer_id: customer_id || 'local-user',
        rating: Number(rating),
        comment: comment || undefined,
      });
    }

    return NextResponse.json({ success: true, review: newReview });
  } catch (error: any) {
    console.error('Post review error:', error);
    return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 });
  }
}
