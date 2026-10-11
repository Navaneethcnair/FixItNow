import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/jobStore';
import fs from 'fs';
import path from 'path';

const STORE_PATH = path.join(process.cwd(), '.local-portfolios.json');

function readLocalStore(): Record<string, any[]> {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {}
  return {};
}

function writeLocalStore(data: Record<string, any[]>): void {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('[portfolioStore] Failed to write local store:', e);
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workerId = searchParams.get('workerId');

  if (!workerId) {
    return NextResponse.json({ error: 'Worker ID is required' }, { status: 400 });
  }

  let portfolio: any[] | null = null;

  // 1. Try Supabase first if configured
  if (isSupabaseConfigured()) {
    try {
      const { createClient } = await import('@/lib/supabase/server');
      const supabase = await createClient();
      
      const { data, error } = await supabase
        .from('worker_portfolios')
        .select('portfolio')
        .eq('worker_id', workerId)
        .maybeSingle();

      if (!error && data && Array.isArray(data.portfolio)) {
        portfolio = data.portfolio;
      }
    } catch {}
  }

  // 2. Try local disk store if Supabase did not return data
  if (portfolio === null) {
    const store = readLocalStore();
    if (store[workerId] && Array.isArray(store[workerId])) {
      portfolio = store[workerId];
    }
  }

  return NextResponse.json({ workerId, portfolio });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workerId, portfolio } = body;

    if (!workerId || !Array.isArray(portfolio)) {
      return NextResponse.json({ error: 'workerId and portfolio array are required' }, { status: 400 });
    }

    // 1. Try Supabase upsert if configured
    if (isSupabaseConfigured()) {
      try {
        const { createClient } = await import('@/lib/supabase/server');
        const supabase = await createClient();
        
        await supabase
          .from('worker_portfolios')
          .upsert({
            worker_id: workerId,
            portfolio,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'worker_id' });
      } catch (e) {
        console.warn('Supabase portfolio upsert warning:', e);
      }
    }

    // 2. Write to local server disk store
    const store = readLocalStore();
    store[workerId] = portfolio;
    writeLocalStore(store);

    return NextResponse.json({ success: true, workerId, portfolio });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save portfolio' }, { status: 500 });
  }
}
