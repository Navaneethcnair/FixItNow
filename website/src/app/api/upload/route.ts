import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, mockJobs } from '@/lib/jobStore';

function mapDetectionToAiResult(detectedClass: string | null, confidence: number, annotatedImage?: string | null) {
  const tradeMap: Record<string, { title: string; description: string; trade: string }> = {
    Masonry: {
      title: 'Masonry Wall Structural Crack Detected',
      description: 'FixItNow Vision AI identified structural damage on a brick/mortar wall surface. Sealing and repair required.',
      trade: 'mason',
    },
    Plumbing: {
      title: 'Plumbing Leak Detected',
      description: 'FixItNow Vision AI identified a possible pipe leak or plumbing fault. Inspection and repair recommended.',
      trade: 'plumber',
    },
    Mobile_Damage: {
      title: 'Mobile Phone Damage Detected',
      description: 'FixItNow Vision AI identified visible damage (screen crack or scratch) on a mobile device. Repair or screen replacement recommended.',
      trade: 'other',
    },
  };

  if (!detectedClass || !tradeMap[detectedClass]) {
    return {
      problem_title: 'No Clear Problem Detected',
      description: 'FixItNow Vision AI could not confidently identify a specific problem in this media. Please try a clearer photo/video or a different angle.',
      trade_required: 'other',
      estimated_dimension: null,
      severity: 'Unknown',
      confidence: confidence || 0,
      specialized_metrics: {},
      detection_image: annotatedImage || null,
    };
  }

  const info = tradeMap[detectedClass];
  const severity = confidence >= 0.7 ? 'High' : confidence >= 0.4 ? 'Moderate' : 'Low';

  return {
    problem_title: info.title,
    description: info.description,
    trade_required: info.trade,
    estimated_dimension: null,
    severity,
    confidence,
    specialized_metrics: { detected_class: detectedClass },
    detection_image: annotatedImage || null,
  };
}

async function analyzeMediaWithLocalModel(file: File) {
  const detectFormData = new FormData();
  detectFormData.append('file', file);

  const response = await fetch('http://127.0.0.1:8001/detect', {
    method: 'POST',
    body: detectFormData,
  });

  if (!response.ok) {
    throw new Error(`Detection service returned ${response.status}`);
  }

  const result = await response.json();
  return mapDetectionToAiResult(result.detected_class, result.confidence, result.annotated_image);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const locationLat = formData.get('locationLat') as string;
    const locationLng = formData.get('locationLng') as string;
    const locationAddress = formData.get('locationAddress') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const isVideo = file.type.startsWith('video/');

    const aiResult = await analyzeMediaWithLocalModel(file);
    const aiModelName = 'FixItNow Vision AI (Local YOLOv8 Engine)';

    // Build a data URL for local preview/storage fallback
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');

    let dbJob = null;
    if (isSupabaseConfigured()) {
      try {
        const { createClient } = await import('@/lib/supabase/server');
        const supabase = await createClient();

        const userPromise = supabase.auth.getUser();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Offline network timeout')), 1200));

        const { data: { user } } = await Promise.race([userPromise, timeoutPromise]) as any;

        if (user) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${user.id}/${Date.now()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from('job-media')
            .upload(fileName, file, { contentType: file.type, upsert: false });

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from('job-media').getPublicUrl(fileName);
            const { data: insertedJob } = await supabase.from('jobs').insert({
              customer_id: user.id,
              media_url: publicUrl,
              media_type: isVideo ? 'video' : 'image',
              status: 'pending',
              location_lat: locationLat ? parseFloat(locationLat) : null,
              location_lng: locationLng ? parseFloat(locationLng) : null,
              location_address: locationAddress || null,
              ai_problem_title: aiResult.problem_title,
              ai_description: aiResult.description,
              ai_trade_required: aiResult.trade_required,
              ai_dimension: aiResult.estimated_dimension,
              ai_severity: aiResult.severity,
              ai_confidence: aiResult.confidence,
              ai_model: aiModelName,
              ai_detection_image: aiResult.detection_image || null,
              specialized_metrics: aiResult.specialized_metrics,
            }).select().single();

            dbJob = insertedJob;
          }
        }
      } catch (err) {
        console.warn('Supabase DB skipped (Offline mode):', err);
      }
    }

    if (dbJob) {
      return NextResponse.json({ success: true, job: dbJob, aiResult });
    }

    // Local / fallback mode
    const mediaUrl = `data:${file.type};base64,${base64}`;

    const localJob = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      customer_id: 'local-user',
      media_url: mediaUrl,
      media_type: (isVideo ? 'video' : 'image') as 'video' | 'image',
      ai_problem_title: aiResult.problem_title,
      ai_description: aiResult.description,
      ai_trade_required: (aiResult.trade_required || 'other') as any,
      ai_dimension: aiResult.estimated_dimension,
      ai_severity: (aiResult.severity || 'moderate') as any,
      ai_confidence: aiResult.confidence,
      ai_model: aiModelName,
      ai_detection_image: aiResult.detection_image || null,
      specialized_metrics: aiResult.specialized_metrics,
      status: 'pending' as const,
      location_lat: locationLat ? parseFloat(locationLat) : null,
      location_lng: locationLng ? parseFloat(locationLng) : null,
      location_address: locationAddress || null,
      assigned_worker_id: null,
      created_at: new Date().toISOString(),
    };

    mockJobs.set(localJob.id, localJob);
    return NextResponse.json({ success: true, job: localJob, aiResult });
  } catch (error: any) {
    console.error('Upload route error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}