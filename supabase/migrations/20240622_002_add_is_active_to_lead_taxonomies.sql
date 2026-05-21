-- Add is_active column to lead_taxonomies table
ALTER TABLE IF EXISTS public.lead_taxonomies
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
