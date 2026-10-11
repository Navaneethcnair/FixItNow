// Server-side database mock for local development without Supabase
import { Job, AIAnalysisResult, Profile, Worker } from '@/lib/types';

// In-memory collections to represent our database tables
export const mockProfiles = new Map<string, Profile>([
  ['w1', { id: 'w1', full_name: 'Rajesh Kumar', phone: '+91 98765 11111', avatar_url: null, role: 'worker', city: 'Mumbai', location_lat: 19.076, location_lng: 72.8777, created_at: new Date().toISOString() }],
  ['w2', { id: 'w2', full_name: 'Suresh Patel', phone: '+91 98765 22222', avatar_url: null, role: 'worker', city: 'Mumbai', location_lat: 19.082, location_lng: 72.881, created_at: new Date().toISOString() }],
  ['w3', { id: 'w3', full_name: 'Anil Sharma', phone: '+91 98765 33333', avatar_url: null, role: 'worker', city: 'Delhi', location_lat: 28.6139, location_lng: 77.209, created_at: new Date().toISOString() }],
  ['w4', { id: 'w4', full_name: 'Vikram Singh', phone: '+91 98765 44444', avatar_url: null, role: 'worker', city: 'Delhi', location_lat: 28.620, location_lng: 77.215, created_at: new Date().toISOString() }],
  ['w5', { id: 'w5', full_name: 'Mohammed Ali', phone: '+91 98765 55555', avatar_url: null, role: 'worker', city: 'Bengaluru', location_lat: 12.9716, location_lng: 77.5946, created_at: new Date().toISOString() }],
  ['w6', { id: 'w6', full_name: 'Deepak Verma', phone: '+91 98765 66666', avatar_url: null, role: 'worker', city: 'Hyderabad', location_lat: 17.385, location_lng: 78.4867, created_at: new Date().toISOString() }],
  ['w7', { id: 'w7', full_name: 'Kiran Reddy', phone: '+91 98765 77777', avatar_url: null, role: 'worker', city: 'Chennai', location_lat: 13.0827, location_lng: 80.2707, created_at: new Date().toISOString() }],
  ['w8', { id: 'w8', full_name: 'Ramesh Gupta', phone: '+91 98765 88888', avatar_url: null, role: 'worker', city: 'Pune', location_lat: 18.5204, location_lng: 73.8567, created_at: new Date().toISOString() }],
  ['w9', { id: 'w9', full_name: 'Sanjay Mishra', phone: '+91 98765 99999', avatar_url: null, role: 'worker', city: 'Kolkata', location_lat: 22.5726, location_lng: 88.3639, created_at: new Date().toISOString() }],
  ['w10', { id: 'w10', full_name: 'Pradeep Yadav', phone: '+91 98765 00000', avatar_url: null, role: 'worker', city: 'Jaipur', location_lat: 26.9124, location_lng: 75.7873, created_at: new Date().toISOString() }],
  ['w11', { id: 'w11', full_name: 'Manjunath Gowda', phone: '+91 98765 12345', avatar_url: null, role: 'worker', city: 'Bengaluru', location_lat: 12.9716, location_lng: 77.5946, created_at: new Date().toISOString() }],
  ['w12', { id: 'w12', full_name: 'Abdul Hameed', phone: '+91 98765 23456', avatar_url: null, role: 'worker', city: 'Mumbai', location_lat: 19.076, location_lng: 72.8777, created_at: new Date().toISOString() }],
  ['w13', { id: 'w13', full_name: 'Santosh Naik', phone: '+91 98765 34567', avatar_url: null, role: 'worker', city: 'Mangaluru', location_lat: 12.9141, location_lng: 74.8560, created_at: new Date().toISOString() }],
  ['w14', { id: 'w14', full_name: 'Dharmendra Yadav', phone: '+91 98765 45678', avatar_url: null, role: 'worker', city: 'Delhi', location_lat: 28.6139, location_lng: 77.209, created_at: new Date().toISOString() }],
  ['w15', { id: 'w15', full_name: 'Lata Devi', phone: '+91 98765 56789', avatar_url: null, role: 'worker', city: 'Chennai', location_lat: 13.0827, location_lng: 80.2707, created_at: new Date().toISOString() }],
  ['w16', { id: 'w16', full_name: 'Prashanth Shetty', phone: '+91 98765 67890', avatar_url: null, role: 'worker', city: 'Udupi', location_lat: 13.3410, location_lng: 74.7470, created_at: new Date().toISOString() }],
  ['w17', { id: 'w17', full_name: 'Santosh Poojary', phone: '+91 98765 78901', avatar_url: null, role: 'worker', city: 'Mangaluru', location_lat: 12.9141, location_lng: 74.8560, created_at: new Date().toISOString() }],
  ['w18', { id: 'w18', full_name: 'Ajay Nair', phone: '+91 98765 81818', avatar_url: null, role: 'worker', city: 'Bengaluru', location_lat: 12.9716, location_lng: 77.5946, created_at: new Date().toISOString() }],
  ['local-user', { id: 'local-user', full_name: 'Local User', phone: '+91 98765 43210', avatar_url: null, role: 'customer', city: 'Mumbai', location_lat: 19.076, location_lng: 72.8777, created_at: new Date().toISOString() }],
]);

export const mockUsers = new Map<string, any>([
  ['customer@example.com', { id: 'local-user', email: 'customer@example.com', password: 'password', full_name: 'Local User', role: 'customer' }],
  ['worker@example.com', { id: 'w1', email: 'worker@example.com', password: 'password', full_name: 'Rajesh Kumar', role: 'worker' }]
]);

// 3 Designated Demo Workers (w1, w16, w17). All other workers are real/dynamic with rating: 0, total_reviews: 0
export const mockWorkers = new Map<string, Worker>([
  ['w1', { id: 'w1', trade: 'plumber', bio: 'Experienced plumber specializing in residential pipe repair and water systems.', experience_years: 8, hourly_rate: 350, rating: 4.8, total_reviews: 127, is_available: true, is_verified: true, radius_km: 15 }],
  ['w2', { id: 'w2', trade: 'plumber', bio: 'Master plumber with expertise in commercial and residential plumbing.', experience_years: 12, hourly_rate: 450, rating: 0, total_reviews: 0, is_available: true, is_verified: true, radius_km: 20 }],
  ['w3', { id: 'w3', trade: 'electrician', bio: 'Certified electrician handling wiring, panels, and socket repairs.', experience_years: 10, hourly_rate: 400, rating: 0, total_reviews: 0, is_available: true, is_verified: true, radius_km: 12 }],
  ['w4', { id: 'w4', trade: 'electrician', bio: 'Expert in electrical diagnostics, inverter installations, and rewiring.', experience_years: 6, hourly_rate: 300, rating: 0, total_reviews: 0, is_available: true, is_verified: true, radius_km: 10 }],
  ['w5', { id: 'w5', trade: 'carpenter', bio: 'Skilled carpenter for furniture repair, door fixing, and woodwork.', experience_years: 15, hourly_rate: 500, rating: 0, total_reviews: 0, is_available: true, is_verified: true, radius_km: 25 }],
  ['w6', { id: 'w6', trade: 'painter', bio: 'Interior and exterior painting specialist with 9 years of experience.', experience_years: 9, hourly_rate: 350, rating: 0, total_reviews: 0, is_available: true, is_verified: true, radius_km: 15 }],
  ['w7', { id: 'w7', trade: 'ac_tech', bio: 'AC repair and servicing expert for split, window, and central AC units.', experience_years: 7, hourly_rate: 400, rating: 0, total_reviews: 0, is_available: true, is_verified: true, radius_km: 18 }],
  ['w8', { id: 'w8', trade: 'mason', bio: 'Expert mason for wall repairs, tiling, and concrete work.', experience_years: 11, hourly_rate: 380, rating: 0, total_reviews: 0, is_available: true, is_verified: true, radius_km: 20 }],
  ['w9', { id: 'w9', trade: 'welder', bio: 'Welding specialist for gates, grills, and structural steel repairs.', experience_years: 13, hourly_rate: 420, rating: 0, total_reviews: 0, is_available: true, is_verified: true, radius_km: 15 }],
  ['w10', { id: 'w10', trade: 'other', bio: 'Versatile handyman for general home repairs and maintenance.', experience_years: 5, hourly_rate: 250, rating: 0, total_reviews: 0, is_available: true, is_verified: true, radius_km: 10 }],
  ['w16', { id: 'w16', trade: 'other', bio: 'Certified electronics & general device repair specialist in Udupi.', experience_years: 6, hourly_rate: 350, rating: 4.9, total_reviews: 112, is_available: true, is_verified: true, radius_km: 25 }],
  ['w17', { id: 'w17', trade: 'other', bio: 'Handyman and gadget repair technician in coastal Karnataka.', experience_years: 7, hourly_rate: 320, rating: 4.8, total_reviews: 84, is_available: true, is_verified: true, radius_km: 30 }],
]);

export const mockJobs = new Map<string, Job>();
export const mockBookings = new Map<string, any>();
export const mockMessages = new Map<string, any[]>();
export const mockReviews = new Map<string, any>([
  ['r1', { id: 'r1', worker_id: 'w17', customer_id: 'local-user', rating: 5, comment: 'Highly recommended! Arrived on time, identified the problem instantly, and did a clean job.', created_at: new Date(Date.now() - 86400000 * 2).toISOString(), profiles: { full_name: 'Priya Mehta' } }],
  ['r2', { id: 'r2', worker_id: 'w17', customer_id: 'local-user', rating: 5, comment: 'Professional service at a very reasonable rate. Cleaned up afterwards. Will book again.', created_at: new Date(Date.now() - 86400000 * 5).toISOString(), profiles: { full_name: 'Arjun Singh' } }],
  ['r3', { id: 'r3', worker_id: 'w16', customer_id: 'local-user', rating: 5, comment: 'Fixed my electronic unit quickly with genuine replacement components.', created_at: new Date(Date.now() - 86400000 * 3).toISOString(), profiles: { full_name: 'Karan Sharma' } }],
]);

let counter = 1;

function generateId(): string {
  return `local-${Date.now()}-${counter++}`;
}

export function createJob(params: {
  customer_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  location_lat?: number | null;
  location_lng?: number | null;
  location_address?: string | null;
}): Job {
  const id = generateId();
  const job: Job = {
    id,
    customer_id: params.customer_id,
    media_url: params.media_url,
    media_type: params.media_type,
    ai_problem_title: null,
    ai_description: null,
    ai_trade_required: null,
    ai_dimension: null,
    ai_severity: null,
    ai_confidence: null,
    ai_detection_image: null,
    status: 'pending',
    location_lat: params.location_lat ?? null,
    location_lng: params.location_lng ?? null,
    location_address: params.location_address ?? null,
    assigned_worker_id: null,
    created_at: new Date().toISOString(),
  };
  mockJobs.set(id, job);
  return job;
}

export function updateJobWithAI(jobId: string, result: AIAnalysisResult): Job | null {
  const job = mockJobs.get(jobId);
  if (!job) return null;
  job.ai_problem_title = result.problem_title;
  job.ai_description = result.description;
  job.ai_trade_required = result.trade_required;
  job.ai_dimension = result.estimated_dimension;
  job.ai_severity = result.severity;
  job.ai_confidence = result.confidence;
  job.ai_detection_image = result.detection_image || null;
  job.status = 'pending';
  mockJobs.set(jobId, job);
  return job;
}

export function getJob(jobId: string): Job | null {
  return mockJobs.get(jobId) ?? null;
}

export function addReview(review: { worker_id: string; customer_id: string; rating: number; comment?: string; profiles?: { full_name: string } }) {
  const id = generateId();
  const newReview = {
    id,
    worker_id: review.worker_id,
    customer_id: review.customer_id,
    rating: review.rating,
    comment: review.comment || null,
    created_at: new Date().toISOString(),
    profiles: review.profiles || { full_name: 'Verified Customer' }
  };
  mockReviews.set(id, newReview);

  // Recalculate rating and total reviews for the worker dynamically in real-time
  const workerRevs = Array.from(mockReviews.values()).filter(r => r.worker_id === review.worker_id);
  const avgRating = workerRevs.reduce((acc, r) => acc + (Number(r.rating) || 5), 0) / workerRevs.length;

  const w = mockWorkers.get(review.worker_id);
  if (w) {
    w.rating = Math.round(avgRating * 10) / 10;
    w.total_reviews = workerRevs.length;
    mockWorkers.set(review.worker_id, w);
  }

  return newReview;
}

export function getReviewsForWorker(workerId: string) {
  return Array.from(mockReviews.values()).filter(r => r.worker_id === workerId);
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !!url && !url.includes('YOUR_PROJECT_REF');
}
