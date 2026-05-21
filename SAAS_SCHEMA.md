# SaaS Database Schema & Permissions Reference

This reference document outlines the complete SaaS-grade relational schema, trigger-based audit logs, Row Level Security (RLS) policies, and permission configurations implemented in the Project Management Portal (PMP).

---

## 1. Security & Core SaaS Permissions

Every action in the system is governed by a secure, role-based permission system consisting of three core tables: `profiles`, `roles`, and `permissions`. 

### System Roles
1. **Super Admin**: Full global system configuration, all modules, and permission management.
2. **Admin**: Project management, user assignments, full leads CRM, and operational finance actions.
3. **Manager**: Team-scoped management, lead assignments, and time-tracking approval.
4. **Developer / Team Member**: Works on assigned tasks, records timers, and view permitted scopes.
5. **QA / Viewer**: Specific quality-assurance workflow and read-only views.
6. **Client**: Restricted client portal views.

### Permissions Inventory (SaaS Seeded)

#### 🔑 Dashboard & Activity
* `dashboard.view`: Access base dashboard.
* `dashboard.stats.view`: View metrics and charts.
* `dashboard.team_performance`: Performance widgets.
* `auth.activity.view` / `auth.activity.manage`: Track user logins.

#### 🔑 Leads CRM
* `leads.view.own` / `leads.view.team` / `leads.view.all`: Scoped leads visibility.
* `leads.create` / `leads.update` / `leads.delete`: Leads operations.
* `leads.import`: Bulk outreach import.
* `leads.followups.view` / `leads.followups.create` / `leads.followups.update` / `leads.followups.delete`: Dynamic followup sheets.
* `leads.taxonomies.manage`: Administrative control over Niches & Services taxonomy options.

#### 🔑 Time Tracking & Sessions
* `time.view` / `time.view.team` / `time.view.all`: Scoped log sheets.
* `time.create` / `time.update` / `time.delete`: Time-log entries.
* `time.approve`: Approve pending developer hours.
* `time.sessions.view` / `time.sessions.manage`: Interactive active timer sessions.

#### 🔑 Operational Finance
* `finance.view`: Base finance visibility.
* `finance.payments.view` / `finance.payments.manage`: Inbound client transactions.
* `finance.expenses.view` / `finance.expenses.manage`: Operational expense tracking.
* `finance.clients.view` / `finance.clients.manage`: Client CRM linkage.
* `finance.founders.view` / `finance.founders.manage`: Vested founder equity.
* `finance.salary.view` / `finance.salary.manage`: Payroll operations.
* `finance.taxes.view` / `finance.taxes.manage`: Project taxation modals.
* `finance.commissions.view` / `finance.commissions.manage`: External resource revenue commissions.
* `finance.dashboard.view`: Aggregated revenue, profit margins, and liabilities cards.

---

## 2. Table-by-Table Schema Layout

### 🏷️ Leads Taxonomies (`lead_taxonomies`)
Handles niches and services available in the system. Authorized users can add or modify them; normal users can only select.
* `id` (uuid, Primary Key)
* `taxonomy_type` (text, check: `'niche'`, `'service'`)
* `name` (text, unique per type)
* `slug` (text, unique per type, URL-friendly)
* `description` (text, optional)
* `color` (text, default `'#64748b'`)
* `is_active` (boolean, default `true`)
* `created_by` (uuid references profiles)
* `created_at` / `updated_at` (timestamptz)

### 🏷️ Lead Taxonomy Links (`lead_taxonomy_links`)
Many-to-many relationship linking a Lead to Niches and Services.
* `id` (uuid, Primary Key)
* `lead_id` (uuid references leads, delete cascade)
* `taxonomy_id` (uuid references lead_taxonomies, delete cascade)
* `selection_type` (text, check: `'niche'`, `'service'`)
* `created_at` (timestamptz)

### ⏱️ Time Tracking Sessions (`time_tracking_sessions`)
Maintains active live-timer sessions and aggregates daily leads statistics.
* `id` (uuid, Primary Key)
* `user_id` (uuid references profiles, delete cascade)
* `project_id` (uuid references projects, delete set null)
* `task_id` (uuid references tasks, delete set null)
* `lead_id` (uuid references leads, delete set null)
* `session_date` (date, default current_date)
* `started_at` (timestamptz)
* `stopped_at` (timestamptz, nullable)
* `session_status` (text, check: `'running'`, `'stopped'`, `'saved'`, `'cancelled'`)
* `entry_mode` (text, check: `'timer'`, `'manual'`)
* `source_platform` (text, check: `'manual'`, `'facebook'`, `'instagram'`, `'x'`, `'website'`, `'referral'`, `'social'`, `'cold_call'`, `'email_campaign'`, `'whatsapp'`, `'linkedin'`, `'other'`)
* `source_platform_other` (text, nullable)
* `lead_generation_target` (integer, default `0`)
* `leads_generated_count` (integer, default `0`) - *Updated in real-time as leads are entered during active timer sessions*
* `manual_leads_count` (integer, default `0`)
* `total_minutes` (integer, default `0`)
* `notes` (text, nullable)

### ⏱️ Time Tracking Session Leads (`time_tracking_session_leads`)
Links leads created during a live active session to their generating timer session.
* `id` (uuid, Primary Key)
* `session_id` (uuid references time_tracking_sessions, delete cascade)
* `lead_id` (uuid references leads, delete cascade, unique)
* `created_at` (timestamptz)

### 💰 Salary Runs (`salary_runs`)
Represents independent payroll runs, incorporating multi-month liability calculations, tax splits, and founder reserves.
* `id` (uuid, Primary Key)
* `salary_month` (date)
* `currency` (text, default `'USD'`)
* `total_salary` (numeric)
* `future_fund_amount` (numeric) - *10% reserve from profit calculated at runtime*
* `tax_amount` (numeric, default `0`)
* `commission_amount` (numeric, default `0`)
* `founder_profit` (numeric, default `0`)
* `notes` (text, nullable)
* `created_by` (uuid references profiles)

### 💰 Salary Entries (`salary_entries`)
Represents individual items inside a Salary Run, with multi-month distribution support.
* `id` (uuid, Primary Key)
* `salary_run_id` (uuid references salary_runs, delete cascade)
* `user_id` (uuid references profiles, delete cascade)
* `months_count` (integer, default `1`)
* `monthly_salary` (numeric)
* `total_salary` (numeric)
* `auto_calculated` (boolean, default `true`)
* `notes` (text, nullable)

### 📊 Project Taxes (`project_taxes`)
Calculates taxes per project on monthly, yearly, or custom durations.
* `id` (uuid, Primary Key)
* `project_id` (uuid references projects, delete cascade)
* `title` (text)
* `rate` (numeric, rate percentage)
* `amount` (numeric, fixed tax amount if applicable)
* `currency` (text, default `'USD'`)
* `status` (text, check: `'active'`, `'inactive'`)
* `effective_from` / `effective_to` (date)
* `created_by` (uuid references profiles)

### 📈 Project Commissions (`project_commissions`)
Tracks outsider resource commissions linked to specific projects.
* `id` (uuid, Primary Key)
* `project_id` (uuid references projects, delete cascade)
* `title` (text)
* `rate` (numeric)
* `amount` (numeric)
* `currency` (text, default `'USD'`)
* `status` (text)
* `effective_from` / `effective_to` (date)
* `created_by` (uuid references profiles)

---

## 3. Database Triggers & RLS Policy Enforcements

### Automatic Slugs
Lead taxonomies enforce strict lowercase, hyphenated unique indexes. Typing `Digital Marketing` will validate and resolve to a clean slug `digital-marketing`.

### Row Level Security (RLS) Scoping
To maintain strict tenant isolation and ensure normal users only access their own records:
- **`lead_taxonomies_write_scoped`**: Only allowed if `current_user_can_manage_lead_taxonomies()` is true.
- **`leads_select_scoped`**: Allows selects if `created_by = auth.uid()` or `assigned_to = auth.uid()` or the user holds `leads.view.team` or `leads.view.all`.
- **`time_tracking_sessions_scoped`**: Restricts regular users from editing/viewing other team members' running sessions. Deleting logs is secured by RLS requiring `time.delete` or administrative permission.
