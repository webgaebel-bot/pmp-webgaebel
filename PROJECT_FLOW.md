# Project Management Portal - System Flow

## 1. Purpose

This document explains the real flow of the app as it exists in this repo:

- Which pages exist
- Which permissions protect them
- How data moves from the UI to the API layer and Supabase
- How dashboard, project, lead, finance, time, user, role, mail, and notification modules work together
- What happens when records are created, edited, deleted, or fetched

The goal is to keep this file aligned with the current codebase, not with older REST assumptions.

---

## 2. High-Level Architecture

```text
User Browser
  -> React App
  -> AuthProvider
  -> MainLayout
  -> ProtectedRoute / PermissionGuard
  -> Page Components
  -> api service / supabaseApi service
  -> Supabase auth, storage, RPC, tables
```

### Main layers

- `src/App.tsx`
  - Central router
  - Public routes and protected routes
  - Route-level permission gate

- `src/contexts/AuthContext.tsx`
  - Hydrates the logged-in user
  - Stores token and normalized permissions
  - Exposes `hasPermission`, `hasAnyPermission`, and auth state

- `src/components/layout/MainLayout.tsx`
  - Shared shell for protected pages
  - Renders sidebar, topbar, and page outlet

- `src/components/auth/ProtectedRoute.tsx`
  - Blocks routes without auth or without required permissions

- `src/components/auth/PermissionGuard.tsx`
  - Hides buttons, cards, actions, and page sections

- `src/services/api.ts`
  - Frontend API wrapper
  - Chooses REST backend or Supabase service depending on env/provider

- `src/services/supabaseApi.ts`
  - Supabase-backed application logic
  - Handles reports, CRUD, permissions, fallback logic, and secure operations

---

## 3. Authentication Flow

### Login flow

```text
Login page
  -> user enters email/password
  -> api.login()
  -> Supabase auth.signInWithPassword
  -> profile lookup
  -> role lookup
  -> role permissions lookup
  -> user is normalized and stored
  -> app navigates to dashboard
```

### Auth hydration flow

```text
App mount
  -> AuthProvider checks token + stored user
  -> api.getCurrentUser()
  -> profile + role + permissions refreshed
  -> normalized user stored in memory and localStorage
  -> MainLayout renders
```

### Logout flow

```text
Logout click
  -> api.logout()
  -> token cleared
  -> stored user cleared
  -> redirect to /login
```

### Important auth rules

- Super Admin is always allowed by `isSuperAdminRole()`
- Admin is detected by role name containing `admin`
- Permission strings are normalized and expanded before checks
- Aliases and implied permissions are supported
- If a user has `roles.manage` or `permissions.manage`, they are treated as admin-level for many backend access checks

---

## 4. Permission Model

### Permission sources

- System permissions live in `public.permissions`
- Role assignments live in `public.role_permissions`
- User roles live in `public.roles` and `public.profiles.role_id`
- Project-level permissions live in `public.project_roles` and `public.project_permissions`

### Frontend permission helpers

- `src/lib/permissions.ts`
  - System permission definitions
  - Aliases and implied permissions
  - `userHasPermission`
  - `userHasAnyPermission`
  - `userHasAllPermissions`

- `src/lib/projectPermissions.ts`
  - Project permission definitions
  - Sanitizes project role permission arrays
  - Adds implied project permissions

- `src/hooks/usePermission.ts`
  - Friendly access helpers for pages and components
  - Example methods:
    - `canViewProjects()`
    - `canCreateTask()`
    - `canManageTaxes()`
    - `canViewReports()`
    - `canManageProjectRoles()`

### Route-level rule

If a route is wrapped in `ProtectedRoute` with a permission, the user must have that permission.

### Section-level rule

Even if a page loads, buttons and actions inside it can still be hidden using `PermissionGuard` or `usePermission()`.

---

## 5. Route Map

### Public routes

- `/login`
- `/forgot-password`
- `/contact-admin`
- `/unauthorized`

### Protected routes

| Route | Access rule | Purpose |
| --- | --- | --- |
| `/dashboard` | `dashboard.view` or `sales.dashboard.view` | Main landing dashboard |
| `/sales-dashboard` | `sales.dashboard.view` or `sales.view` | Sales-oriented dashboard |
| `/projects` | `projects.view` | Projects list |
| `/projects/:id` | `projects.view` | Project detail |
| `/projects/:id/roles` | `projects.view` plus project role checks inside page | Project members and project roles |
| `/projects/:id/edit` | `projects.update` | Project edit page |
| `/tasks` | `tasks.view` | Tasks workspace |
| `/tasks/my` | `tasks.view` | Personal tasks view |
| `/tasks/:id` | `tasks.view` | Task detail |
| `/tasks/:id/edit` | `tasks.update` | Task edit |
| `/mails` | `mails.view` | Mail workspace |
| `/calendar` | `calendar.view` | Calendar page |
| `/users` | `users.view` | Users list |
| `/users/:id` | `users.view` | User detail |
| `/users/:id/edit` | `users.update` | User edit |
| `/roles` | `roles.view` | Roles and permissions admin page |
| `/reports` | `reports.view` | Reports and analytics |
| `/finance` | `finance.view` | Finance dashboard |
| `/finance/records` | `finance.view` | Taxes and commissions page |
| `/finance/payments` | `finance.view` | Payments page |
| `/finance/expenses` | `finance.view` | Expenses page |
| `/finance/salary` | `finance.view` | Salary page |
| `/salary` | `finance.view` | Alias for salary page |
| `/finance/clients` | `finance.view` | Finance clients page |
| `/finance/founders` | `finance.view` | Founders page |
| `/finance/settings` | `finance.view` | Finance settings page |
| `/time-tracking` | `time.view` | Time tracking page |
| `/leads` | `leads.view` | Leads CRM |
| `/leads/taxonomies` | `leads.taxonomies.manage` | Lead taxonomy admin |
| `/guidance` | `dashboard.view` | Basic workflow guide |
| `/system-guide` | Admin only | Global guide for elevated users |
| `/activity` | `activity_logs.view` | Activity log page |
| `/settings` | `users.view` | Personal settings shell |
| `/settings/profile` | `users.view` | Profile settings |
| `/notifications` | `notifications.view` | Notifications page |

### Important access note

- `system-guide` is additionally restricted in the sidebar and topbar to admin users.
- `guidance`, `settings`, and `notifications` were aligned with explicit permissions so they are no longer accidental open pages.

---

## 6. Shell Navigation Flow

### Sidebar

- Renders the main module list
- Hides items when permission is missing
- Uses active route highlighting
- Keeps `System Guide` visible only for admin users

### Topbar

- Provides:
  - Global search
  - Notifications dropdown
  - Profile menu
  - Sidebar toggle
- Search results are filtered by permissions
- Some routes appear in shortcuts only if the user is allowed to open them

### MainLayout

```text
Auth check
  -> if loading, show spinner
  -> if not authenticated, redirect to /login
  -> if authenticated, show shell
  -> render sidebar + topbar + page content
```

---

## 7. Dashboard Flow

`src/pages/Dashboard.tsx` is the main system hub.

### What it loads

- Dashboard stats
- Project progress report
- Team performance report
- Task distribution report
- Task activity report
- Activity logs
- Lead stats
- Recent leads
- Lead ownership report
- Finance stats

### Dashboard logic

```text
User opens /dashboard
  -> permission check
  -> parallel fetch of reports
  -> data normalized for cards and charts
  -> admin sections render only if user is admin
  -> sales-specific dashboard sections render only for sales permission
```

### Dashboard sections

- Overview cards
- Project progress chart
- Team performance chart
- Task status chart
- Recent activity
- Lead analytics
- Calendar overview
- Finance snapshot
- Quick actions

### Permission behavior

- Non-admin users only see the parts allowed by permission
- Admin users get richer widgets, charts, and logs

---

## 8. Projects Flow

### Projects list page

`src/pages/Projects.tsx`

- Fetches accessible projects
- Supports search and filters
- Shows project cards or table entries
- Launches create/edit/delete actions if allowed

### Project detail page

`src/pages/ProjectDetail.tsx`

- Loads:
  - project data
  - members
  - roles
  - tasks
  - files
- Provides project-specific actions:
  - edit project
  - create task
  - add member
  - manage files
  - open member/task drawers

### Project edit page

`src/pages/ProjectEdit.tsx`

- Edits project metadata
- Only users with `projects.update` can open it

### Project roles page

`src/pages/ProjectRoles.tsx`

- Manages project members
- Manages project role definitions
- Uses `project_roles` and `project_permissions`
- Checks `project.roles.manage` or `projects.manage` in the current project role

### Project creation flow

```text
Create project form
  -> api.createProject()
  -> Supabase create_project_secure_v2 RPC if available
  -> fallback insert into projects table
  -> seed default project roles
  -> add creator as owner member
  -> log activity
```

### Project role flow

```text
Project roles page
  -> fetch roles
  -> fetch available project permissions
  -> map role permission keys to badges and checkboxes
  -> save role or update role
  -> invalidate project role query
```

### Data tables used

- `projects`
- `project_members`
- `project_roles`
- `project_permissions`
- `tasks`
- `files`

---

## 9. Tasks Flow

### Tasks list page

`src/pages/Tasks.tsx`

- Loads tasks visible to the current user
- Supports:
  - all tasks
  - my tasks
  - task search
  - filtering
  - task status changes

### Task detail page

`src/pages/TaskDetail.tsx`

- Shows task metadata
- Comments
- Files
- Assignee information
- Status and priority controls

### Task edit page

`src/pages/TaskEdit.tsx`

- Edits task title, description, priority, due date, assignee, etc.

### Task actions

```text
User creates/updates task
  -> api.createTask / api.updateTask / api.updateTaskStatus / api.updateTaskPriority
  -> tasks table updated
  -> comments/files counters may refresh
  -> dashboard and project queries invalidate
```

### Task permissions

- `tasks.view`
- `tasks.view.all`
- `tasks.create`
- `tasks.update`
- `tasks.delete`
- `tasks.assign`
- `tasks.update_status`
- `tasks.update_priority`
- `comments.create`
- `comments.delete`
- `files.upload`
- `files.delete`

---

## 10. Leads Flow

### Main leads page

`src/pages/leads/Leads.tsx`

This is one of the richest modules in the app.

### Lead views

- Flexible sheet view
- Kanban view
- Detail drawer
- Follow-up tab
- Analytics panel
- Filter/search bar

### Lead capabilities

- Create lead
- Edit lead
- Delete lead
- Import leads
- Manage tags
- Manage contacts
- Add notes
- Add activities
- Schedule follow-ups
- View own/team/all leads based on permissions

### Lead detail drawer

`src/components/leads/LeadDetailDrawer.tsx`

- Shows lead-specific details
- Lets admin or permitted users inspect and edit the record

### Follow-up and taxonomy management

`src/pages/leads/ManageTaxonomies.tsx`

- Manages niche/service taxonomy data
- Requires `leads.taxonomies.manage`

### Lead data flow

```text
Leads page opens
  -> fetch lead list
  -> fetch related follow-up data
  -> fetch analytics/stats
  -> render sheet/kanban/detail views
  -> write actions update leads table and related tables
  -> socket or invalidation refreshes UI
```

### Lead tables used

- `leads`
- `lead_activities`
- `lead_notes`
- `lead_followups`
- `lead_contacts`
- `lead_tags`
- `lead_tag_links`
- `lead_taxonomies`

---

## 11. Finance Flow

Finance is a separate subsystem with its own dashboard and record pages.

### Finance dashboard

`src/pages/finance/FinanceDashboard.tsx`

- Shows revenue
- Shows expenses
- Shows net profit
- Shows outstanding
- Shows gross profit
- Shows future fund
- Shows founder profit
- Shows liabilities
- Shows quick actions

### Finance record pages

- `Payments.tsx`
- `Expenses.tsx`
- `Clients.tsx`
- `Founders.tsx`
- `Salary.tsx`
- `FinanceTaxCommissions.tsx`
- `FinanceSettings.tsx`

### Finance data flow

```text
Finance page opens
  -> permission check
  -> fetch records from Supabase
  -> normalize finance rows
  -> calculate summary stats
  -> render totals, tables, modals, and charts
  -> save actions invalidate finance queries
```

### Finance dashboard data source

- Payments
- Expenses
- Finance settings
- Founders equity
- Taxes and commissions settings

### Finance calculations

- Revenue = sum of completed payments
- Expenses = sum of expense records
- Net Profit = Revenue - Expenses
- Outstanding = sum of unfinished payments
- Future Fund / Tax / Commission / Founder Profit are derived from finance settings

### Finance permissions

- `finance.view`
- `finance.view.own`
- `finance.view.team`
- `finance.view.all`
- `finance.payments.view`
- `finance.payments.manage`
- `finance.expenses.view`
- `finance.expenses.manage`
- `finance.clients.view`
- `finance.clients.manage`
- `finance.founders.view`
- `finance.founders.manage`
- `finance.salaries.view`
- `finance.salaries.manage`
- `finance.taxes.view`
- `finance.taxes.manage`
- `finance.commissions.view`
- `finance.commissions.manage`
- `finance.settings.manage`

### Finance tables used

- `payments`
- `expenses`
- `clients`
- `founders`
- `salary_runs`
- `salary_entries`
- `project_taxes`
- `project_commissions`
- `finance_settings`
- `system_currencies`

### Important finance behavior

- The frontend now normalizes payment methods and other payloads before saving
- Tax and commission pages use minimal, schema-safe payloads
- Finance stats fallback to all-time data if the selected range is empty

---

## 12. Time Tracking Flow

`src/pages/time-tracking/TimeTracking.tsx`

### What it does

- Tracks work sessions
- Supports sales activity and project activity
- Shows own, team, or all logs depending on permission
- Allows approve/reject and session management where permitted

### Time data flow

```text
Start session / manual log
  -> api.createTimeLog or session RPC/fallback
  -> time_tracking_sessions or time_logs updated
  -> stats refresh
  -> dashboard or activity panels refresh
```

### Time tables used

- `time_logs`
- `time_tracking_sessions`

### Time permissions

- `time.view`
- `time.view.own`
- `time.view.team`
- `time.view.all`
- `time.create`
- `time.update`
- `time.delete`
- `time.approve`
- `time.manage`
- `time.sessions.manage`

---

## 13. Users, Roles, and Permissions Flow

### Users page

`src/pages/Users.tsx`

- Lists users
- Shows role and permissions summary
- Supports create/edit/delete if allowed

### User detail page

`src/pages/UserDetail.tsx`

- Shows profile info
- Shows user permissions
- Shows assignment and activity context

### User edit page

`src/pages/UserEdit.tsx`

- Edits user profile and role assignment

### Roles page

`src/pages/Roles.tsx`

- Lists system roles
- Loads all available permissions
- Lets admin assign permissions to roles
- Uses `role_permissions` join table

### Permissions page behavior

- Permission list is seeded from `PERMISSION_DEFINITIONS`
- If DB is empty, the frontend seed logic repopulates missing permissions

### Permission write flow

```text
Role opened
  -> get role permissions
  -> render matrix grouped by module
  -> user toggles permissions
  -> save role permission set
  -> delete old role_permissions rows
  -> insert selected permission rows
  -> refresh role list
```

### Tables used

- `profiles`
- `roles`
- `permissions`
- `role_permissions`

---

## 14. Mails Flow

`src/pages/Mails.tsx`

### Mail modules

- Inbox
- Sent
- All mails
- Thread view
- Compose
- Reply

### Mail components

- `MailList.tsx`
- `MailDetail.tsx`
- `MailDetailView.tsx`
- `MailCompose.tsx`
- `MailReply.tsx`
- `MailSidebar.tsx`

### Mail data flow

```text
Compose or reply
  -> resolve recipients
  -> create thread if needed
  -> create mail row
  -> create recipient rows
  -> create attachments if present
  -> refresh inbox/sent views
```

### Mail tables used

- `mails`
- `mail_threads`
- `mail_recipients`
- `mail_attachments`

### Mail permissions

- `mails.view`
- `mails.view.all`
- `mails.send`
- `mails.reply`
- `mails.delete`
- `mails.manage`
- `mail_threads.view`
- `mail_threads.create`

---

## 15. Calendar Flow

`src/pages/Calendar.tsx`

### Behavior

- Loads calendar items through the API layer
- Displays personal or project-linked events
- Is permission-gated by `calendar.view`

### Calendar permissions

- `calendar.view`
- `calendar.view.all`
- `calendar.project.view`
- `calendar.manage`

### Note

The exact persistence backing for calendar data is handled through the API/service layer. The frontend treats it as a calendar workspace and does not need to know the raw storage strategy.

---

## 16. Notifications and Activity Flow

### Notifications page

`src/pages/Notifications.tsx`

- Lists notifications
- Filters read/unread
- Clears individual notifications or all notifications
- Refreshes on socket updates

### Activity page

`src/pages/Activity.tsx`

- Shows audit activity
- Provides a log view for user and admin actions

### Activity log source

- `activity_logs`

### Notification source

- `notifications`

### Real-time flow

```text
User performs an action
  -> logActivity() writes activity_logs
  -> notification row inserted
  -> socket event fires
  -> notifications/activity pages refresh
```

---

## 17. Settings and Profile Flow

`src/pages/Settings.tsx`

### What it does

- Updates personal profile
- Uploads avatar
- Changes password
- Saves notification preferences

### Settings data flow

```text
Settings page opens
  -> fetch profile
  -> fetch notification preferences
  -> user edits form
  -> update profile via FormData or JSON
  -> optional avatar upload to Supabase storage
  -> refresh auth context
```

### Permissions

- Route now requires `users.view`
- Profile write actions depend on backend/profile ownership checks

### Storage

- Avatar uploads use Supabase storage bucket `files`

---

## 18. Guidance and System Guide

### Guidance page

`src/pages/Guidance.tsx`

- Simple lead workflow guide
- Useful for users who need a short how-to
- Requires dashboard access

### System guide page

`src/pages/SystemGuide.tsx`

- Admin-only global guide
- Explains the system at a high level
- Only visible to Super Admin and Admin users

---

## 19. Supporting Utility Flow

### Loading and empty states

- `LoadingSpinner.tsx`
- `ModuleState.tsx`
- `EmptyState.tsx`
- `ErrorMessage.tsx`

These components standardize loading, error, and empty-screen behavior across the app.

### Common UI building blocks

- `PageHeader.tsx`
- `StatsCard.tsx`
- `StatusBadge.tsx`
- `PriorityBadge.tsx`
- `ProgressBar.tsx`

### File upload flow

- `files` table stores file metadata
- `fileService` handles uploads
- `uploadToStorage()` sends files to Supabase storage
- Public URL is resolved back into the UI

---

## 20. Security and Access Control Flow

### Frontend checks

- `ProtectedRoute`
- `PermissionGuard`
- `usePermission`
- Sidebar and topbar item filtering

### Backend/security checks

- `requirePermission()`
- `requireOwnership()`
- `requireProjectMembership()`
- `resolveScope()`
- `evaluateRole()`

### Access scopes

- `own`
- `project`
- `team`
- `all`

### Rule summary

- Own data is the default
- Team and all scopes need explicit permission
- Admin-level users can see more, but still respect route guards
- Project-level admin is separate from system-level admin

---

## 21. Data Model Summary

### Identity and access

- `profiles`
- `roles`
- `permissions`
- `role_permissions`

### Work management

- `projects`
- `project_members`
- `project_roles`
- `project_permissions`
- `tasks`
- `task_comments`
- `files`

### Lead CRM

- `leads`
- `lead_activities`
- `lead_notes`
- `lead_followups`
- `lead_contacts`
- `lead_tags`
- `lead_tag_links`
- `lead_taxonomies`

### Finance

- `clients`
- `expenses`
- `payments`
- `founders`
- `salary_runs`
- `salary_entries`
- `project_taxes`
- `project_commissions`
- `finance_settings`
- `system_currencies`

### Time tracking

- `time_logs`
- `time_tracking_sessions`

### Collaboration and audit

- `mails`
- `mail_threads`
- `mail_recipients`
- `mail_attachments`
- `notifications`
- `activity_logs`
- `audit_logs`

---

## 22. Common End-to-End Flows

### A. User opens app

```text
Browser opens app
  -> auth token checked
  -> user hydrated
  -> shell renders
  -> menu items filtered by permission
  -> user navigates to allowed page
```

### B. User creates a project

```text
Projects page
  -> create project form
  -> validation
  -> project insert
  -> default project roles seeded
  -> owner membership created
  -> activity log written
  -> project list invalidated
```

### C. User creates a task

```text
Task form
  -> validate inputs
  -> create task row
  -> refresh task list
  -> update dashboard metrics
  -> maybe notify assigned user
```

### D. User writes finance record

```text
Finance form
  -> normalize payload
  -> insert payment/expense/client/founder/tax/commission
  -> invalidate finance stats
  -> dashboard finance snapshot refreshes
```

### E. User updates role permissions

```text
Roles page
  -> load permissions matrix
  -> choose permissions
  -> save role_permissions rows
  -> refresh role list
  -> user access updates after next auth refresh
```

---

## 23. Known Behavior To Keep In Sync

- Permission definitions in `src/lib/permissions.ts` must stay aligned with the DB `permissions` table
- Project permissions in `src/lib/projectPermissions.ts` must stay aligned with `project_permissions`
- Route permissions in `src/App.tsx` must match the sidebar/topbar shortcuts
- Dashboard widgets should only fetch data the current user is allowed to see
- Finance pages should keep using normalized payloads so DB checks do not fail on bad values
- Any new module should be added in all three places:
  - route map
  - sidebar/topbar navigation
  - permission definition list

---

## 24. Quick Reference

### Main entry points

- `src/App.tsx`
- `src/contexts/AuthContext.tsx`
- `src/components/layout/MainLayout.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/Topbar.tsx`
- `src/services/supabaseApi.ts`

### Permission helpers

- `src/lib/permissions.ts`
- `src/lib/projectPermissions.ts`
- `src/hooks/usePermission.ts`

### Core pages

- `src/pages/Dashboard.tsx`
- `src/pages/Projects.tsx`
- `src/pages/Tasks.tsx`
- `src/pages/leads/Leads.tsx`
- `src/pages/finance/FinanceDashboard.tsx`
- `src/pages/time-tracking/TimeTracking.tsx`
- `src/pages/Users.tsx`
- `src/pages/Roles.tsx`
- `src/pages/Mails.tsx`
- `src/pages/Reports.tsx`

---

## 25. Final Notes

- This portal is now structured as a permission-driven workspace, not a fully open app.
- The dashboard is the summary hub.
- Projects and tasks are the delivery core.
- Leads is the CRM core.
- Finance is a separate controlled subsystem.
- Users, roles, and permissions are the governance layer.
- Mails, notifications, activity, and time tracking connect everything together.

If this file needs to be split later, the best next step would be:

- `AUTH_FLOW.md`
- `PROJECTS_FLOW.md`
- `TASKS_FLOW.md`
- `LEADS_FLOW.md`
- `FINANCE_FLOW.md`
- `ACCESS_CONTROL_FLOW.md`

