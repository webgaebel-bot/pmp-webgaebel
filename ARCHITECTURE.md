# Permission System Architecture

## How the Permission System Works

```
┌─────────────────────────────────────────────────────────────┐
│                    USER LOGS IN                             │
│              (/api/auth/login)                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            BACKEND RETURNS USER DATA                        │
│  {                                                          │
│    id: 23,                                                  │
│    name: "hunain",                                          │
│    role_id: 5,                                              │
│    role: { id: 5, name: "DEVELOPER" },                      │
│    permissions: [                                           │
│      "dashboard.view",                                      │
│      "projects.view",                                       │
│      "projects.create",                                     │
│      "tasks.view",                                          │
│      ...                                                    │
│    ]                                                        │
│  }                                                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│           AuthContext STORES USER & TOKEN                   │
│  • In React state                                           │
│  • In localStorage for persistence                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│        COMPONENT CALLS usePermission() HOOK                 │
│                                                             │
│  const permission = usePermission();                        │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┬─────────────────┐
        │                         │                 │
        ▼                         ▼                 ▼
    permission.         permission.canAny()   permission.can()
    canCreateProject()   ([...])             ('projects.create')
        │                         │                 │
        └────────────┬────────────┴─────────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │  CHECK AGAINST USER        │
        │  PERMISSIONS ARRAY         │
        └────────────┬───────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
    PERMISSION              NO PERMISSION
    GRANTED                 DENIED
        │                         │
        ▼                         ▼
    RENDER UI           HIDE UI / DISABLE
    ENABLE ACTION       BUTTON
```

## Component Permission Check Flow

```
Component Mount
      │
      ▼
┌─────────────────────────────┐
│ Call usePermission()        │
│ Get permission object       │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Check canViewProjects()     │
│ (permission.canViewProjects │
│  checks user.permissions    │
│  array)                     │
└──────────┬──────────────────┘
           │
       ┌───┴────┐
       │        │
       ▼        ▼
    TRUE      FALSE
       │        │
       ▼        ▼
    RENDER  SHOW ERROR
    PAGE    (Access Denied)
       │
       ▼
    ┌──────────────────────┐
    │ Check canCreateProject
    │ canEditProject       │
    │ canDeleteProject     │
    └──────┬───────────────┘
           │
       ┌───┼───┐
       │   │   │
       ▼   ▼   ▼
     YES YES YES
       │   │   │
       ▼   ▼   ▼
    SHOW SHOW SHOW
    CREATE EDIT DELETE
    BUTTON BUTTON BUTTON
```

## Permission Guard Component Flow

```
<PermissionGuard permission="projects.create">
  <CreateButton />
</PermissionGuard>
      │
      ▼
┌──────────────────────────────┐
│ PermissionGuard Component    │
│ Props:                       │
│ - permission: string | []    │
│ - requireAll: boolean        │
│ - fallback: ReactNode        │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ If Array:                    │
│  - requireAll=false:         │
│    any match = true          │
│  - requireAll=true:          │
│    all match = true          │
│                              │
│ If String:                   │
│  - Check exact match         │
└──────────┬───────────────────┘
           │
       ┌───┴────┐
       │        │
       ▼        ▼
    TRUE      FALSE
       │        │
       ▼        ▼
   RENDER   RENDER
 children   fallback
```

## Permission Check Methods Hierarchy

```
usePermission()
    │
    ├── Generic Methods
    │   ├── can(permission: string)
    │   ├── canAny(permissions: [])
    │   └── canAll(permissions: [])
    │
    ├── Role Methods
    │   ├── isSuperAdmin()
    │   ├── isAdmin()
    │   ├── isProjectManager()
    │   ├── isDeveloper()
    │   └── isViewer()
    │
    └── Feature Methods
        ├── Projects
        │   ├── canViewProjects()
        │   ├── canCreateProject()
        │   ├── canEditProject()
        │   ├── canDeleteProject()
        │   └── canManageProjectMembers()
        │
        ├── Tasks
        │   ├── canViewTasks()
        │   ├── canCreateTask()
        │   ├── canEditTask()
        │   ├── canDeleteTask()
        │   ├── canUpdateTaskStatus()
        │   └── canUpdateTaskPriority()
        │
        ├── Users
        │   ├── canViewUsers()
        │   ├── canCreateUser()
        │   ├── canEditUser()
        │   └── canDeleteUser()
        │
        ├── Comments
        │   ├── canCreateComment()
        │   ├── canDeleteComment()
        │   └── canEditComment()
        │
        ├── Files
        │   ├── canUploadFiles()
        │   ├── canDeleteFiles()
        │   └── canDownloadFiles()
        │
        ├── Members
        │   ├── canViewMembers()
        │   └── canManageMembers()
        │
        ├── Reports
        │   ├── canViewReports()
        │   └── canGenerateReports()
        │
        ├── Activity
        │   └── canViewActivity()
        │
        ├── Settings
        │   ├── canAccessSettings()
        │   └── canUpdateSettings()
        │
        ├── Dashboard
        │   └── canViewDashboard()
        │
        └── Notifications
            └── canViewNotifications()
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND DATABASE                         │
│  ┌────────────┐  ┌────────────┐  ┌──────────────┐          │
│  │   Users    │  │   Roles    │  │ Permissions  │          │
│  ├────────────┤  ├────────────┤  ├──────────────┤          │
│  │id: 23      │  │id: 5       │  │id: 1         │          │
│  │name: hun.. │  │name: DEV   │  │name: projects│          │
│  │role_id: 5  │  └────────────┘  │.view         │          │
│  └────────────┘                   └──────────────┘          │
└────────────────┬──────────────────────────────────────────┘
                 │
      /api/auth/me response
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                 FRONTEND - AuthContext                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ AuthState {                                          │  │
│  │   user: {                                            │  │
│  │     id: 23,                                          │  │
│  │     name: "hunain",                                  │  │
│  │     role: { id: 5, name: "DEVELOPER" },              │  │
│  │     permissions: [                                   │  │
│  │       "dashboard.view",                              │  │
│  │       "projects.view",                               │  │
│  │       "projects.create",                             │  │
│  │       "tasks.view",                                  │  │
│  │       ...                                            │  │
│  │     ]                                                │  │
│  │   },                                                 │  │
│  │   token: "jwt_token_here",                           │  │
│  │   isAuthenticated: true,                             │  │
│  │   isLoading: false                                   │  │
│  │ }                                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Also in localStorage for persistence                      │
└────────────────┬──────────────────────────────────────────┘
                 │
   usePermission() reads from
   AuthContext and localStorage
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│          COMPONENT - Permission Check Methods               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ const permission = usePermission();                  │  │
│  │                                                      │  │
│  │ permission.canCreateProject()                        │  │
│  │ → checks if "projects.create" in user.permissions   │  │
│  │ → returns boolean                                    │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────┬──────────────────────────────────────────┘
                 │
     Returns boolean (true/false)
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              CONDITIONAL RENDERING                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ {permission.canCreateProject() && (                  │  │
│  │   <Button>Create Project</Button>                    │  │
│  │ )}                                                   │  │
│  │                                                      │  │
│  │ true  → Button is rendered                           │  │
│  │ false → Button is NOT rendered                       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Permission Check Decision Tree

```
                    START
                      │
                      ▼
           Is user Super Admin?
                  /      \
                YES       NO
                 │         │
                 ▼         ▼
              GRANT    Check if permission
              ACCESS   in user.permissions[]
                 │         │
                 │    ┌────┴────┐
                 │    │         │
                 │   YES        NO
                 │    │         │
                 └────┬─────────┘
                      │
                      ▼
              ┌──────────────┐
              │ GRANT/DENY   │
              │ ACCESS       │
              └──────────────┘
```

## Example: User trying to Delete a Project

```
User clicks "Delete" button
        │
        ▼
Component calls handleDelete()
        │
        ▼
Backend checks: Can user with ID 23 delete project 5?
        │
        ├─ BEFORE IMPLEMENTATION:
        │  No permission check at component level
        │  Only checked at backend
        │
        └─ AFTER IMPLEMENTATION:
           ▼
        Component checks: permission.canDeleteProject()
           │
           ├─ FALSE (No "projects.delete" permission)
           │  │
           │  ▼
           │ Delete button is hidden
           │ User never sees it
           │
           └─ TRUE (Has "projects.delete" permission)
              │
              ▼
           Delete button is shown/enabled
           User clicks it
           │
           ▼
        Backend verifies permission again (secure!)
           │
           ├─ VALID: Deletes project
           └─ INVALID: Rejects request (defense in depth)
```

## Key Points

1. **Frontend checks** are for UX - don't show buttons user can't use
2. **Backend always validates** - never trust frontend permissions
3. **Super Admin bypasses** everything - hardcoded in permission checks
4. **Permissions stored** in both state and localStorage
5. **Checks are fast** - simple array includes() operations
6. **Real-time updates** - call refreshAuth() after role changes
