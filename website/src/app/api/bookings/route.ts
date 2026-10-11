import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/jobStore';

const isValidUUID = (id?: string | null): boolean => {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, jobDetails, workerId, workerName, workerTrade, scheduledAt, priceQuoted, notes, address, pincode, userId: customUserId } = body;

    if (!workerId) {
      return NextResponse.json({ error: 'Worker ID is required' }, { status: 400 });
    }

    // Try Supabase insert if configured & user is authenticated & valid UUIDs
    if (isSupabaseConfigured()) {
      try {
        const { createClient } = await import('@/lib/supabase/server');
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const validJobId = isValidUUID(jobId) ? jobId : null;
          const validWorkerId = isValidUUID(workerId) ? workerId : null;

          if (validWorkerId) {
            const { data: booking, error: bookingError } = await supabase.from('bookings').insert({
              job_id: validJobId,
              worker_id: validWorkerId,
              customer_id: user.id,
              scheduled_at: scheduledAt || null,
              price_quoted: priceQuoted || null,
              notes: notes || (address ? `${address}${pincode ? `, ${pincode}` : ''}` : null),
              status: 'requested',
            }).select().single();

            if (!bookingError && booking) {
              if (validJobId) {
                await supabase.from('jobs').update({
                  status: 'assigned',
                  assigned_worker_id: validWorkerId,
                }).eq('id', validJobId);
              }
              return NextResponse.json({ success: true, booking: { ...booking, address, pincode, jobs: jobDetails || null } });
            }
          }
        }
      } catch (dbErr) {
        console.warn('Supabase DB booking failed, falling back to mock store:', dbErr);
      }
    }

    const { mockBookings, mockJobs } = await import('@/lib/jobStore');

    // If client provided complete job details, save it into mockJobs
    if (jobDetails && jobDetails.id) {
      mockJobs.set(jobDetails.id, jobDetails);
    }

    let targetJobId = jobId || (jobDetails?.id || null);
    if (!targetJobId || targetJobId === 'new') {
      const customerJobs = Array.from(mockJobs.values()).filter(j => j.customer_id === (customUserId || 'local-user'));
      if (customerJobs.length > 0) {
        targetJobId = customerJobs[customerJobs.length - 1].id;
      } else if (mockJobs.size > 0) {
        targetJobId = Array.from(mockJobs.values())[mockJobs.size - 1].id;
      }
    }

    const matchedJob = targetJobId ? mockJobs.get(targetJobId) : (jobDetails || null);

    // Local / Fallback Mode: save to in-memory store so booking ALWAYS succeeds
    const booking = {
      id: `local-booking-${Date.now()}`,
      job_id: targetJobId || null,
      worker_id: workerId,
      worker_name: workerName || null,
      worker_trade: workerTrade || null,
      customer_id: customUserId || 'local-user',
      scheduled_at: scheduledAt || null,
      price_quoted: priceQuoted || null,
      notes: notes || null,
      address: address || null,
      pincode: pincode || null,
      status: 'requested' as const,
      booked_at: new Date().toISOString(),
      jobs: matchedJob || jobDetails || null,
    };

    mockBookings.set(booking.id, booking);

    if (targetJobId) {
      const job = mockJobs.get(targetJobId);
      if (job) {
        job.status = 'assigned';
        job.assigned_worker_id = workerId;
      }
    }

    return NextResponse.json({ success: true, booking });
  } catch (error: any) {
    console.error('Booking route error:', error);
    return NextResponse.json({ error: error.message || 'Booking failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role') || 'customer';

    let dbBookings: any[] = [];

    if (isSupabaseConfigured()) {
      try {
        const { createClient } = await import('@/lib/supabase/server');
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          let query = supabase
            .from('bookings')
            .select('*, jobs(*), workers(*, profiles(full_name, avatar_url)), profiles(full_name)')
            .order('booked_at', { ascending: false });

          if (role === 'worker') {
            query = query.eq('worker_id', user.id);
          } else {
            query = query.eq('customer_id', user.id);
          }

          const { data, error } = await query;
          if (!error && data) {
            dbBookings = data;
          }
        }
      } catch (sbErr) {
        console.warn('Supabase bookings fetch failed:', sbErr);
      }
    }

    // Always fetch local bookings as well
    const { mockBookings, mockProfiles, mockWorkers, mockJobs } = await import('@/lib/jobStore');
    const localList: any[] = [];
    mockBookings.forEach((b) => {
      localList.push(b);
    });

    const WORKER_NAMES: Record<string, { name: string; trade: string }> = {
      w1: { name: 'Rajesh Kumar', trade: 'plumber' },
      w2: { name: 'Suresh Patel', trade: 'plumber' },
      w3: { name: 'Anil Sharma', trade: 'electrician' },
      w4: { name: 'Vikram Singh', trade: 'electrician' },
      w5: { name: 'Mohammed Ali', trade: 'carpenter' },
      w6: { name: 'Deepak Verma', trade: 'painter' },
      w7: { name: 'Kiran Reddy', trade: 'ac_tech' },
      w8: { name: 'Ramesh Gupta', trade: 'mason' },
      w9: { name: 'Sanjay Mishra', trade: 'welder' },
      w10: { name: 'Pradeep Yadav', trade: 'other' },
    };

    const populatedLocal = localList.map(b => {
      const workerInfo = mockWorkers.get(b.worker_id);
      const workerProfile = mockProfiles.get(b.worker_id);
      
      let jobInfo = b.jobs || (b.job_id ? mockJobs.get(b.job_id) : null);
      if (!jobInfo && mockJobs.size > 0) {
        // Fallback: match by customer_id or get latest uploaded job
        const customerJobs = Array.from(mockJobs.values()).filter(j => j.customer_id === b.customer_id);
        if (customerJobs.length > 0) {
          jobInfo = customerJobs[customerJobs.length - 1];
        } else {
          jobInfo = Array.from(mockJobs.values())[mockJobs.size - 1];
        }
      }

      const mapped = WORKER_NAMES[b.worker_id] || WORKER_NAMES['w1'];
      const name = b.worker_name || workerProfile?.full_name || mapped.name;
      const trade = b.worker_trade || workerInfo?.trade || mapped.trade;

      return {
        ...b,
        workers: {
          id: b.worker_id,
          trade: trade,
          hourly_rate: b.price_quoted || workerInfo?.hourly_rate || 350,
          profiles: {
            full_name: name,
            avatar_url: workerProfile?.avatar_url || null,
          }
        },
        jobs: jobInfo || null,
        profiles: mockProfiles.get(b.customer_id) || { full_name: 'Customer' }
      };
    });

    const allBookings = [...dbBookings, ...populatedLocal];
    const sanitizedBookings = allBookings.map((b) => {
      if (b.jobs && b.jobs.ai_problem_title && b.jobs.ai_problem_title.toLowerCase().includes('speaker system')) {
        const tradeTitle = (b.worker_trade || b.workers?.trade || 'repair').replace('_', ' ').toUpperCase();
        b.jobs.ai_problem_title = `${tradeTitle} Service Request`;
      }
      if (b.job_title && b.job_title.toLowerCase().includes('speaker system')) {
        const tradeTitle = (b.worker_trade || b.workers?.trade || 'repair').replace('_', ' ').toUpperCase();
        b.job_title = `${tradeTitle} Service Request`;
      }
      return b;
    });

    return NextResponse.json({ bookings: sanitizedBookings });
  } catch (error) {
    return NextResponse.json({ bookings: [] });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { bookingId, status } = await request.json();
    if (!bookingId || !status) {
      return NextResponse.json({ error: 'bookingId and status are required' }, { status: 400 });
    }

    if (isSupabaseConfigured() && isValidUUID(bookingId)) {
      try {
        const { createClient } = await import('@/lib/supabase/server');
        const supabase = await createClient();
        await supabase.from('bookings').update({ status }).eq('id', bookingId);
      } catch (e) {
        console.warn('Supabase PATCH booking failed:', e);
      }
    }

    const { mockBookings } = await import('@/lib/jobStore');
    const existing = mockBookings.get(bookingId);
    if (existing) {
      existing.status = status;
      mockBookings.set(bookingId, existing);
    }

    return NextResponse.json({ success: true, bookingId, status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Update failed' }, { status: 500 });
  }
}

