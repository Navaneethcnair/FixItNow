-- FixItNow Database Schema
-- Run this in Supabase SQL Editor (supabase.com → your project → SQL Editor)

-- =============
-- PROFILES
-- =============
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'worker')),
  location_lat FLOAT8,
  location_lng FLOAT8,
  city TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- =============
-- WORKERS
-- =============
CREATE TABLE IF NOT EXISTS workers (
  id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  trade TEXT NOT NULL DEFAULT 'other' CHECK (trade IN ('plumber', 'electrician', 'carpenter', 'painter', 'ac_tech', 'welder', 'mason', 'other')),
  bio TEXT,
  experience_years INT DEFAULT 0,
  hourly_rate NUMERIC DEFAULT 0,
  rating FLOAT4 DEFAULT 0,
  total_reviews INT DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  radius_km INT DEFAULT 20
);

ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workers are viewable by everyone" ON workers FOR SELECT USING (true);
CREATE POLICY "Workers can update their own row" ON workers FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Authenticated users can insert workers" ON workers FOR INSERT WITH CHECK (auth.uid() = id);

-- =============
-- JOBS
-- =============
CREATE TABLE IF NOT EXISTS jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  media_url TEXT,
  media_type TEXT DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  ai_problem_title TEXT,
  ai_description TEXT,
  ai_trade_required TEXT,
  ai_dimension TEXT,
  ai_severity TEXT CHECK (ai_severity IN ('minor', 'moderate', 'urgent')),
  ai_confidence FLOAT4,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled')),
  location_lat FLOAT8,
  location_lng FLOAT8,
  location_address TEXT,
  assigned_worker_id UUID REFERENCES workers(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own jobs" ON jobs FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "Workers can view assigned jobs" ON jobs FOR SELECT USING (auth.uid() = assigned_worker_id);
CREATE POLICY "Users can create jobs" ON jobs FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Users can update own jobs" ON jobs FOR UPDATE USING (auth.uid() = customer_id);
CREATE POLICY "Workers can update assigned jobs" ON jobs FOR UPDATE USING (auth.uid() = assigned_worker_id);

-- =============
-- BOOKINGS
-- =============
CREATE TABLE IF NOT EXISTS bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  worker_id UUID REFERENCES workers(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  booked_at TIMESTAMPTZ DEFAULT NOW(),
  scheduled_at TIMESTAMPTZ,
  status TEXT DEFAULT 'requested' CHECK (status IN ('requested', 'accepted', 'rejected', 'completed')),
  price_quoted NUMERIC
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can view own bookings" ON bookings FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "Workers can view their bookings" ON bookings FOR SELECT USING (auth.uid() = worker_id);
CREATE POLICY "Users can create bookings" ON bookings FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Workers can update booking status" ON bookings FOR UPDATE USING (auth.uid() = worker_id);
CREATE POLICY "Customers can update own bookings" ON bookings FOR UPDATE USING (auth.uid() = customer_id);

-- =============
-- REVIEWS
-- =============
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  worker_id UUID REFERENCES workers(id) ON DELETE CASCADE NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews are viewable by everyone" ON reviews FOR SELECT USING (true);
CREATE POLICY "Users can create reviews" ON reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- =============
-- STORAGE BUCKET for job media
-- =============
INSERT INTO storage.buckets (id, name, public) VALUES ('job-media', 'job-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view job media" ON storage.objects FOR SELECT USING (bucket_id = 'job-media');
CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'job-media' AND auth.role() = 'authenticated');

-- =============
-- SEED DATA: Demo Workers
-- =============

-- Create demo auth users (optional — these won't have real auth, just profile rows)
-- In production, workers sign up through the app.

-- Worker 1: Plumber
INSERT INTO profiles (id, full_name, phone, role, city, location_lat, location_lng)
VALUES ('a0000001-0000-0000-0000-000000000001', 'Ramesh Kumar', '+91 98765 11111', 'worker', 'Mumbai', 19.076, 72.877)
ON CONFLICT (id) DO NOTHING;

INSERT INTO workers (id, trade, bio, experience_years, hourly_rate, rating, total_reviews, is_available, is_verified, radius_km)
VALUES ('a0000001-0000-0000-0000-000000000001', 'plumber', 'Expert plumber with 15 years of experience in pipe repair, drainage systems, and water heater installation. Certified and insured.', 15, 450, 4.8, 234, true, true, 25)
ON CONFLICT (id) DO NOTHING;

-- Worker 2: Electrician
INSERT INTO profiles (id, full_name, phone, role, city, location_lat, location_lng)
VALUES ('a0000002-0000-0000-0000-000000000002', 'Suresh Verma', '+91 98765 22222', 'worker', 'Mumbai', 19.082, 72.880)
ON CONFLICT (id) DO NOTHING;

INSERT INTO workers (id, trade, bio, experience_years, hourly_rate, rating, total_reviews, is_available, is_verified, radius_km)
VALUES ('a0000002-0000-0000-0000-000000000002', 'electrician', 'Licensed electrician specializing in residential wiring, smart home setups, and panel upgrades. Safety-first approach.', 12, 500, 4.9, 189, true, true, 20)
ON CONFLICT (id) DO NOTHING;

-- Worker 3: Carpenter
INSERT INTO profiles (id, full_name, phone, role, city, location_lat, location_lng)
VALUES ('a0000003-0000-0000-0000-000000000003', 'Vikram Patel', '+91 98765 33333', 'worker', 'Delhi', 28.613, 77.209)
ON CONFLICT (id) DO NOTHING;

INSERT INTO workers (id, trade, bio, experience_years, hourly_rate, rating, total_reviews, is_available, is_verified, radius_km)
VALUES ('a0000003-0000-0000-0000-000000000003', 'carpenter', 'Custom furniture maker and door/window specialist. Modern and traditional designs. Quality woodwork guaranteed.', 10, 400, 4.7, 156, true, true, 15)
ON CONFLICT (id) DO NOTHING;

-- Worker 4: Painter
INSERT INTO profiles (id, full_name, phone, role, city, location_lat, location_lng)
VALUES ('a0000004-0000-0000-0000-000000000004', 'Anil Sharma', '+91 98765 44444', 'worker', 'Bengaluru', 12.971, 77.594)
ON CONFLICT (id) DO NOTHING;

INSERT INTO workers (id, trade, bio, experience_years, hourly_rate, rating, total_reviews, is_available, is_verified, radius_km)
VALUES ('a0000004-0000-0000-0000-000000000004', 'painter', 'Interior and exterior painting professional. Texture work, waterproofing, and wall art specialist.', 8, 350, 4.6, 98, true, true, 30)
ON CONFLICT (id) DO NOTHING;

-- Worker 5: AC Technician
INSERT INTO profiles (id, full_name, phone, role, city, location_lat, location_lng)
VALUES ('a0000005-0000-0000-0000-000000000005', 'Manoj Gupta', '+91 98765 55555', 'worker', 'Mumbai', 19.068, 72.870)
ON CONFLICT (id) DO NOTHING;

INSERT INTO workers (id, trade, bio, experience_years, hourly_rate, rating, total_reviews, is_available, is_verified, radius_km)
VALUES ('a0000005-0000-0000-0000-000000000005', 'ac_tech', 'AC installation, repair, and gas refilling. All brands serviced. AMC contracts available.', 6, 550, 4.5, 67, true, true, 20)
ON CONFLICT (id) DO NOTHING;

-- Worker 6: Mason
INSERT INTO profiles (id, full_name, phone, role, city, location_lat, location_lng)
VALUES ('a0000006-0000-0000-0000-000000000006', 'Raju Singh', '+91 98765 66666', 'worker', 'Mumbai', 19.090, 72.875)
ON CONFLICT (id) DO NOTHING;

INSERT INTO workers (id, trade, bio, experience_years, hourly_rate, rating, total_reviews, is_available, is_verified, radius_km)
VALUES ('a0000006-0000-0000-0000-000000000006', 'mason', 'Brickwork, plastering, tiling, and waterproofing expert. New construction and renovation specialist.', 20, 380, 4.7, 145, true, true, 35)
ON CONFLICT (id) DO NOTHING;

-- =============
-- AUTOMATIC PROFILE CREATION TRIGGER
-- Handles both email/password signups and Google OAuth sign-ins
-- =============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role, avatar_url, email)
  VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      ''
    ),
    new.raw_user_meta_data->>'phone',
    COALESCE(new.raw_user_meta_data->>'role', 'customer'),
    COALESCE(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    ),
    new.email
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    phone     = COALESCE(EXCLUDED.phone, profiles.phone),
    role      = COALESCE(EXCLUDED.role, profiles.role),
    avatar_url= COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    email     = COALESCE(EXCLUDED.email, profiles.email);

  IF COALESCE(new.raw_user_meta_data->>'role', 'customer') = 'worker' THEN
    INSERT INTO public.workers (id, trade, experience_years, hourly_rate, rating, total_reviews, is_available, is_verified, radius_km)
    VALUES (new.id, 'other', 0, 0, 0, 0, true, false, 20)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

