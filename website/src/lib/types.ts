export type TradeType =
  | 'plumber'
  | 'electrician'
  | 'carpenter'
  | 'painter'
  | 'ac_tech'
  | 'welder'
  | 'mason'
  | 'lawn_mower'
  | 'tank_cleaner'
  | 'interlock_cleaner'
  | 'interlock_paver'
  | 'gardener'
  | 'cleaning'
  | 'other';

export type SeverityType = 'minor' | 'moderate' | 'urgent';
export type JobStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
export type BookingStatus = 'requested' | 'accepted' | 'rejected' | 'completed';
export type UserRole = 'customer' | 'worker';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  location_lat: number | null;
  location_lng: number | null;
  city: string | null;
  created_at: string;
}

export interface Worker {
  id: string;
  trade: TradeType;
  bio: string | null;
  experience_years: number;
  hourly_rate: number;
  rating: number;
  total_reviews: number;
  is_available: boolean;
  is_verified: boolean;
  radius_km: number;
  services_offered?: string[];
  daily_rate?: number;
  profiles?: Profile;
}

export interface Job {
  id: string;
  customer_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  ai_problem_title: string | null;
  ai_description: string | null;
  ai_trade_required: TradeType | null;
  ai_dimension: string | null;
  ai_severity: SeverityType | null;
  ai_confidence: number | null;
  ai_model?: string | null;
  ai_detection_image?: string | null;
  specialized_metrics?: any;
  resolution_plan?: any;
  status: JobStatus;
  location_lat: number | null;
  location_lng: number | null;
  location_address: string | null;
  assigned_worker_id: string | null;
  worker_instructions?: string;
  created_at: string;
  profiles?: Profile;
}

export interface Booking {
  id: string;
  job_id: string;
  worker_id: string;
  customer_id: string;
  booked_at: string;
  scheduled_at: string | null;
  status: BookingStatus;
  price_quoted: number | null;
  jobs?: Job;
  workers?: Worker & { profiles?: Profile };
  profiles?: Profile;
}

export interface Review {
  id: string;
  booking_id: string;
  reviewer_id: string;
  worker_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  profiles?: Profile;
}

export interface SpecializedMetrics {
  land_size_sqft?: string;
  fuel_required_liters?: string;
  tank_capacity_liters?: string;
  chemical_cleaning_needed?: string;
  brick_count_estimate?: string;
  sand_base_cubic_ft?: string;
  pressure_washer_psi?: string;
  estimated_time_hours?: string;
  solution_steps?: string[];
  roboflow_dataset?: string;
  yolo_model_version?: string;
  bounding_box?: string;
  crack_severity_mm?: string;
  detected_class?: string;
}

export interface AIAnalysisResult {
  problem_title: string;
  description: string;
  trade_required: TradeType;
  estimated_dimension: string;
  severity: SeverityType;
  confidence: number;
  worker_instructions: string;
  specialized_metrics?: SpecializedMetrics;
  ai_model?: string;
  detection_image?: string | null;
}

export const TRADE_CONFIG: Record<TradeType, { label: string; emoji: string; color: string; bg: string }> = {
  plumber: { label: 'Plumber', emoji: '🔧', color: '#0ea5e9', bg: '#e0f2fe' },
  electrician: { label: 'Electrician', emoji: '⚡', color: '#f59e0b', bg: '#fef3c7' },
  carpenter: { label: 'Carpenter', emoji: '🪚', color: '#92400e', bg: '#fef3c7' },
  painter: { label: 'Painter', emoji: '🎨', color: '#8b5cf6', bg: '#ede9fe' },
  ac_tech: { label: 'AC Technician', emoji: '❄️', color: '#06b6d4', bg: '#cffafe' },
  welder: { label: 'Welder', emoji: '🔥', color: '#ef4444', bg: '#fee2e2' },
  mason: { label: 'Mason', emoji: '🧱', color: '#78716c', bg: '#f5f5f4' },
  lawn_mower: { label: 'Lawn Mower', emoji: '🚜', color: '#16a34a', bg: '#dcfce7' },
  tank_cleaner: { label: 'Water Tank Cleaner', emoji: '💧', color: '#0284c7', bg: '#e0f2fe' },
  interlock_cleaner: { label: 'Interlock Brick Cleaner', emoji: '🧼', color: '#0d9488', bg: '#ccfbf1' },
  interlock_paver: { label: 'Interlock Brick Adder', emoji: '🧱', color: '#d97706', bg: '#fef3c7' },
  gardener: { label: 'Gardener & Landscaper', emoji: '🌱', color: '#15803d', bg: '#dcfce7' },
  cleaning: { label: 'Deep Cleaning', emoji: '🧹', color: '#6366f1', bg: '#e0e7ff' },
  other: { label: 'General Repair Worker', emoji: '🛠️', color: '#4f46e5', bg: '#eef2ff' },
};
