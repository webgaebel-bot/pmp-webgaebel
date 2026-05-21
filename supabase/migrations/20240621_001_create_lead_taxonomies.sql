-- Create lead_taxonomies table
CREATE TABLE IF NOT EXISTS public.lead_taxonomies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  taxonomy_type VARCHAR(50) NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
