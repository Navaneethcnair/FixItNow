import { NextRequest, NextResponse } from 'next/server';
import { analyzeImageWithGemini } from '@/lib/gemini';
import { isSupabaseConfigured, updateJobWithAI } from '@/lib/jobStore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, base64Image, mimeType } = body;

    if (!base64Image || !mimeType) {
      return NextResponse.json({ error: 'Missing image data' }, { status: 400 });
    }

    // Run Gemini analysis (with automatic fallback so it never fails)
    const result = await analyzeImageWithGemini(base64Image, mimeType);

    if (isSupabaseConfigured()) {
      try {
        const { createClient } = await import('@/lib/supabase/server');
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user && jobId) {
          await supabase.from('jobs').update({
            ai_problem_title: result.problem_title,
            ai_description: result.description,
            ai_trade_required: result.trade_required,
            ai_dimension: result.estimated_dimension,
            ai_severity: result.severity,
            ai_confidence: result.confidence,
            status: 'pending',
          }).eq('id', jobId).eq('customer_id', user.id);
        }
      } catch (dbErr) {
        console.warn('Supabase DB job update skipped:', dbErr);
      }
    }

    // Local / fallback mode: update in-memory store
    if (jobId) {
      updateJobWithAI(jobId, result);
    }

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Analyze route error:', error);
    return NextResponse.json({ error: error.message || 'Analysis failed' }, { status: 500 });
  }
}
