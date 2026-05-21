-- Prevent duplicate taxonomy names within the same taxonomy type
create unique index if not exists lead_taxonomies_name_type_unique_idx
  on public.lead_taxonomies (lower(name), taxonomy_type);
