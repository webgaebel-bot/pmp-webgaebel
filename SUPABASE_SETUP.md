# Supabase Setup

## What was migrated

This frontend now supports direct Supabase access for these core modules:

- Auth login/logout/current user
- Users listing and editing
- Roles and permissions
- Projects and project members
- Tasks and task comments
- Dashboard stats/reports
- Activity logs

Modules like mail, finance, leads, file upload, calendar, and some profile/media flows still depend on the old REST API unless you migrate them next.

## 1. Create Supabase project

Create a new Supabase project, then open:

- `SQL Editor`
- `Authentication`
- `Project Settings > API`

## 2. Run schema

Copy and run:

- [supabase/schema.sql](/E:/Agnecy%20Work/Projects/Project%20Management%20Portal/PMP%20Frontend/orbit-grid-suite/supabase/schema.sql)

## 3. Add frontend env vars

Update [.env](/E:/Agnecy%20Work/Projects/Project%20Management%20Portal/PMP%20Frontend/orbit-grid-suite/.env):

```env
VITE_DATA_PROVIDER=supabase
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_STORAGE_BUCKET=attachments
```

## 4. Create first admin

Because direct browser-side admin user creation is not safe with Supabase Auth, create the first user from the Supabase dashboard:

1. `Authentication > Users > Add user`
2. Use that user's UUID and set their role to `Super Admin`

Run this in SQL Editor after creating the first auth user:

```sql
update public.profiles
set role_id = (
  select id from public.roles where lower(name) = 'super admin' limit 1
)
where email = 'your-admin@email.com';
```

## 5. Important limitation

The existing `Add User` / `Delete User` admin actions cannot safely manage Supabase Auth users directly from the browser.

For production, use one of these:

- Supabase Auth dashboard for manual admin user management
- A Supabase Edge Function for invite/create/delete user actions
- A lightweight secure backend just for admin auth management

## 6. Fallback behavior

If you still keep `VITE_BACKEND_API_BASE_URL`, unmigrated modules can continue using the old REST API.
