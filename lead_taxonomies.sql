-- Create lead_taxonomies table
CREATE TABLE IF NOT EXISTS public.lead_taxonomies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  taxonomy_type VARCHAR(50) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optional seed data (if needed)
-- INSERT INTO public.lead_taxonomies (name, taxonomy_type, is_active) VALUES ('Technology', 'niche', true), ('Consulting', 'service', true) ON CONFLICT DO NOTHING;
