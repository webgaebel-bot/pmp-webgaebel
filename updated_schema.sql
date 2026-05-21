-- Updated Database Schema

-- 1. Create System Currencies Table
CREATE TABLE IF NOT EXISTS public.system_currencies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(10) NOT NULL UNIQUE,
  symbol VARCHAR(10) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed defaults
INSERT INTO public.system_currencies (code, symbol, name) VALUES
('USD', '$', 'US Dollar'),
('EUR', '€', 'Euro'),
('GBP', '£', 'British Pound'),
('PKR', 'Rs', 'Pakistani Rupee')
ON CONFLICT (code) DO NOTHING;

-- 2. Project Taxes Table
CREATE TABLE IF NOT EXISTS public.project_taxes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  rate DECIMAL(5,2),
  amount DECIMAL(15,2),
  currency VARCHAR(10) DEFAULT 'USD',
  effective_from DATE,
  effective_to DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Project Commissions Table
CREATE TABLE IF NOT EXISTS public.project_commissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  rate DECIMAL(5,2),
  amount DECIMAL(15,2),
  currency VARCHAR(10) DEFAULT 'USD',
  effective_from DATE,
  effective_to DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Enforce Project Roles
-- Create the column if it doesn't exist, then ensure it is populated before setting it to NOT NULL
ALTER TABLE public.project_members ADD COLUMN IF NOT EXISTS project_role VARCHAR(50) DEFAULT 'member';
UPDATE public.project_members SET project_role = 'member' WHERE project_role IS NULL;
ALTER TABLE public.project_members ALTER COLUMN project_role SET NOT NULL;

-- 5. Activity Logs for Authentication and Timer Tracking
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100),
  entity_id VARCHAR(100),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead Taxonomies Table
CREATE TABLE IF NOT EXISTS public.lead_taxonomies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  taxonomy_type VARCHAR(50) NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- Time Logs enhancements
ALTER TABLE public.time_logs ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL;

-- Row Level Security
ALTER TABLE public.system_currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Base Policies
CREATE POLICY "Enable read access for all authenticated users" ON public.system_currencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable all access for admins" ON public.system_currencies FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name = 'super_admin')
);

CREATE POLICY "View taxes if project member or admin" ON public.project_taxes FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = project_taxes.project_id AND pm.user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'finance'))
);

CREATE POLICY "View commissions if project member or admin" ON public.project_commissions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = project_commissions.project_id AND pm.user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'finance'))
);
