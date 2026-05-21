-- Migration: add is_active column to lead_taxonomies
ALTER TABLE IF EXISTS public.lead_taxonomies
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
