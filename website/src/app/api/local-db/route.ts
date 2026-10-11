import { NextRequest, NextResponse } from 'next/server';
import { mockProfiles, mockWorkers, mockJobs, mockBookings, mockReviews } from '@/lib/jobStore';
import { userExists, createUser, getAllUsers } from '@/lib/userStore';

export async function POST(request: NextRequest) {
  try {
    const { table, action, filters, data } = await request.json();

    // ─── USERS TABLE — backed by persistent file store ───────────────────────
    if (table === 'users') {
      if (action === 'select') {
        let results = getAllUsers();
        if (filters && filters.length > 0) {
          results = results.filter((user) =>
            filters.every((f: any) => user[f.field] === f.value)
          );
        }
        return NextResponse.json({ data: results });
      }

      if (action === 'insert') {
        const rows = Array.isArray(data) ? data : [data];
        for (const row of rows) {
          if (userExists(row.email)) {
            return NextResponse.json({ error: 'User already exists' }, { status: 409 });
          }
          createUser({
            id: row.id || `local-user-${Date.now()}`,
            email: row.email,
            password: row.password,
            full_name: row.full_name || row.email.split('@')[0],
            role: row.role || 'customer',
            phone: row.phone || '',
          });
        }
        return NextResponse.json({ data: rows.length === 1 ? rows[0] : rows });
      }

      return NextResponse.json({ error: `Unsupported action '${action}' on users` }, { status: 400 });
    }

    // ─── ALL OTHER TABLES — in-memory maps ───────────────────────────────────
    let targetMap: Map<string, any>;
    if (table === 'profiles') targetMap = mockProfiles;
    else if (table === 'workers') targetMap = mockWorkers;
    else if (table === 'jobs') targetMap = mockJobs;
    else if (table === 'bookings') targetMap = mockBookings;
    else if (table === 'reviews') targetMap = mockReviews;
    else return NextResponse.json({ data: [] });

    if (action === 'insert') {
      const rows = Array.isArray(data) ? data : [data];
      rows.forEach((row: any) => {
        const id = row.id || `local-${table}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        targetMap.set(id, { ...row, id });
      });
      return NextResponse.json({ data: rows.length === 1 ? rows[0] : rows });
    }

    if (action === 'update') {
      const matches: any[] = [];
      targetMap.forEach((val, key) => {
        let match = true;
        if (filters && filters.length > 0) {
          for (const f of filters) {
            if (val[f.field] !== f.value) { match = false; break; }
          }
        }
        if (match) {
          const updated = { ...val, ...data };
          targetMap.set(key, updated);
          matches.push(updated);
        }
      });
      return NextResponse.json({ data: matches });
    }

    if (action === 'select') {
      const results: any[] = [];
      targetMap.forEach((val) => {
        let match = true;
        if (filters && filters.length > 0) {
          for (const f of filters) {
            if (val[f.field] !== f.value) { match = false; break; }
          }
        }
        if (match) {
          const item = { ...val };
          if (table === 'workers') {
            item.profiles = mockProfiles.get(val.id) || null;
          } else if (table === 'bookings') {
            item.profiles = mockProfiles.get(val.customer_id) || null;
            item.jobs = mockJobs.get(val.job_id) || null;
            const w = mockWorkers.get(val.worker_id);
            if (w) item.workers = { ...w, profiles: mockProfiles.get(w.id) || null };
          } else if (table === 'reviews') {
            item.profiles = mockProfiles.get(val.customer_id) || { full_name: 'Customer' };
          }
          results.push(item);
        }
      });
      return NextResponse.json({ data: results });
    }

    if (action === 'delete') {
      const deleted: any[] = [];
      targetMap.forEach((val, key) => {
        let match = true;
        if (filters && filters.length > 0) {
          for (const f of filters) {
            if (val[f.field] !== f.value) { match = false; break; }
          }
        }
        if (match) { deleted.push(val); targetMap.delete(key); }
      });
      return NextResponse.json({ data: deleted });
    }

    return NextResponse.json({ error: `Unknown action ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('Local DB endpoint error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
