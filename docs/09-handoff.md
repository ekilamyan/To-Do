# Project Handoff & History

## Project Summary

**Taskflow** is an Asana-inspired task management Angular 21 SPA. It was built from scratch in a single session using a multi-agent workflow, then extended with Supabase auth and database storage in a second session. The app is fully functional with Supabase persistence, email/password auth, dark/light theming, subtasks, sorting, drag-and-drop reordering, and inline editing.

---

## Session 1: Initial Build (Multi-Agent Workflow)

We used a **role-based agent pipeline** where 4 specialized agents ran sequentially:

### Agent 1: Designer
- Created all SCSS files and HTML templates
- Established the CSS custom property theme system (light/dark)
- Chose fonts (DM Sans body, Sora headings, JetBrains Mono for dates/counts)
- Defined the 8-column CSS grid layout for table rows
- Created styling for every component

### Agent 2: Coder
- Built all TypeScript logic on top of the designer's styles
- Created the data model (`Task`, `Priority`, `TaskStatus`)
- Built `TaskService` (signal-based state, CRUD, localStorage, assignee pool)
- Built `ThemeService` (dark/light toggle, OS preference detection, localStorage)
- Implemented all components with Angular standalone components and signals
- Set up routing (3 tabs + redirect)

### Agent 3: Code Reviewer
Found and fixed **8 bugs** before the user ever saw the app:
1. `[class]` binding wiping out static classes on sort headers
2. Missing permanent delete button for deleted tab
3. Completed/deleted restore buttons invisible (opacity: 0) — added `always-visible` class
4. Datalist ID collisions across task rows — made IDs unique per task
5. Check icon not visible on hover for complete button
6. Subtasks not filtered by current tab status
7. CSS budget exceeded on task-row.scss — raised budget limit
8. Missing flex layout on action cell for multiple buttons

### Agent 4: Tester
- Ran `ng build` — clean first attempt, no errors
- Verified dev server starts on http://localhost:4200

### Post-Build Refinements (Session 1)
1. **Creation row moved to top** and all fields made always visible
2. **Date picker styled** to match the app
3. **Edit button added** to every task row (pencil icon) toggling full inline edit mode

---

## Session 2: Supabase Auth + Database

### What was added
- **Supabase auth** — email/password sign in, sign up, forgot password with email reset link
- **Supabase database** — all tasks and assignees stored in PostgreSQL with Row Level Security
- **Removed localStorage** for task/assignee data (theme preference still uses localStorage)
- **Login page** — single component, 3 views (login / signup / forgot), matching app design
- **Auth guards** — unauthenticated users redirected to `/login`; authenticated users redirected away from `/login`
- **Header auth UI** — logged-in email + "Sign out" button in the app header

### New files added
| File | Purpose |
|------|---------|
| `src/environments/environment.ts` | Supabase URL + anon key |
| `src/app/core/supabase.client.ts` | Singleton Supabase client DI token |
| `src/app/models/mapper.ts` | camelCase ↔ snake_case conversion (app ↔ DB) |
| `src/app/services/auth.service.ts` | Signal-based auth state + sign in/up/out/reset |
| `src/app/guards/auth.guard.ts` | Redirects unauthenticated users to /login |
| `src/app/guards/login-redirect.guard.ts` | Redirects authenticated users away from /login |
| `src/app/pages/login/login.ts/html/scss` | Login/signup/forgot password UI |
| `docs/10-auth.md` | Auth architecture documentation |

### Files modified
| File | Change |
|------|--------|
| `src/app/services/task.service.ts` | Full rewrite — replaced localStorage with Supabase, optimistic updates |
| `src/app/app.routes.ts` | Added /login route + auth guards on all task routes |
| `src/app/app.config.ts` | Added `provideSupabaseClient()` |
| `src/app/app.ts` | Injected `AuthService`, added `isLoginRoute`, `onLogout()` |
| `src/app/app.html` | Conditional header/nav (hidden on login), user email + sign out button |
| `src/app/app.scss` | Added `.user-email` and `.logout-btn` styles |
| `src/app/pages/*/html` | Added loading state (`taskService.loading()`) |
| `src/app/components/task-table/task-table.ts` | Made `onRestoreTask` async |
| `src/styles.scss` | Added `.loading-state` global style |
| `angular.json` | Raised bundle budget (Supabase SDK adds ~70kB) |

### Bugs fixed in Session 2
1. **Sort order bug** — `reorderTasks` was assigning the highest `sortOrder` to the first item in the new order, causing drag-and-drop to snap to the reverse. Fixed to assign `i + 1` (ascending) so the first item gets the lowest sort value and sorts first.
2. **Deleted subtask count not visible** — When a subtask was deleted, the parent showed in the Deleted tab as a placeholder but no count badge was visible. Fixed by adding `deletedSubtaskCount()` badge to the placeholder row title in `task-row.html`.
3. **Password field style breaks on visibility toggle** — Switching `type="password"` to `type="text"` lost styling because CSS only targeted `input[type='password']`. Fixed by adding `input[type='text']` to the selector in `login.scss`.

---

## Key Design Decisions

| Decision | Reasoning |
|----------|-----------|
| Flat task map (not nested tree) | Simpler state management, easier sorting |
| One level of subtask depth | Matches Asana's basic list view, avoids complexity |
| Signal-based state (no NgRx) | App scope is simple enough for service-based state |
| Single reusable TaskTableComponent | Avoids duplication across 3 tabs |
| Supabase instead of localStorage | Real persistence, multi-device, auth-gated |
| Optimistic updates | Instant UI feedback; rollback via `loadTasks()` on error |
| Trigger sets `user_id` in DB | Client never sends user_id; prevents spoofing |
| Login as single component with 3 views | No extra routes or components for a simple auth flow |
| `authLoading` signal | Prevents guards from redirecting before session resolves on hard refresh |

---

---

## Session 3: Stripe Freemium Integration

### What was added

- **Stripe subscriptions** — $5/month Pro plan via Stripe Checkout
- **Supabase Edge Functions** — three Deno functions handle all server-side Stripe logic
- **`profiles` table** — stores `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `subscription_end_date` per user
- **`SubscriptionService`** — signal-based service loading the profile on login, exposing `isPro` computed signal
- **Feature locking** — Completed/Deleted tabs, dark mode toggle, and priority field are locked for free users
- **`ProChipComponent`** — reusable amber PRO badge shown on locked features
- **`PricingDialogComponent`** — global overlay with feature comparison table + upgrade CTA
- **`UserMenuComponent`** — header dropdown replacing the old email + sign-out button; shows plan status, billing/upgrade, sign out
- **`proGuard`** — route guard blocking free users from navigating to `/completed` and `/deleted` directly
- **Post-checkout handling** — `active.ts` detects `?upgraded=true`, reloads profile, shows snackbar
- **Cancel button** on inline creation row (trash icon, left-aligned title spanning full width)

### New files added

| File | Purpose |
|------|---------|
| `supabase/functions/create-checkout-session/index.ts` | Edge Function: creates Stripe Checkout Session |
| `supabase/functions/stripe-webhook/index.ts` | Edge Function: handles Stripe events, updates profiles |
| `supabase/functions/create-portal-session/index.ts` | Edge Function: opens Stripe Customer Portal |
| `src/app/services/subscription.service.ts` | Pro status signals, dialog control, checkout/portal |
| `src/app/components/pro-chip/` | Reusable PRO badge chip |
| `src/app/components/pricing-dialog/` | Global upgrade dialog |
| `src/app/components/user-menu/` | Header dropdown: plan info + billing + sign out |
| `src/app/guards/pro.guard.ts` | Route guard for `/completed` and `/deleted` |

### Files modified

| File | Change |
|------|--------|
| `src/app/services/theme.service.ts` | Added `setTheme()` method |
| `src/app/components/tab-bar/` | PRO chips on Completed/Deleted, intercept clicks for free users |
| `src/app/components/theme-toggle/` | PRO chip, intercept click for free users |
| `src/app/components/task-table/` | PRO chip on Priority header |
| `src/app/components/task-row/` | Lock priority editing for free users |
| `src/app/components/inline-creation-row/` | Disable priority select for free users; title spans full width; cancel (trash) button |
| `src/app/app.ts/html/scss` | UserMenu replaces email+logout, PricingDialog added globally |
| `src/app/app.routes.ts` | `proGuard` added to `/completed` and `/deleted` |
| `src/app/pages/active/active.ts` | Handle `?upgraded=true` post-checkout redirect |

### Bugs fixed in Session 3

1. **CORS error on Edge Functions** — `x-client-info` and `apikey` headers not in `Access-Control-Allow-Headers`. Added to preflight responses.
2. **401 on Edge Functions from browser** — Supabase's default JWT gateway verification rejected requests. Fixed by redeploying all three functions with `--no-verify-jwt`.
3. **Stripe webhook silently failing** — `stripe-webhook` also needed `--no-verify-jwt`; Stripe doesn't send a Supabase JWT, so the gateway returned 401 to every event, preventing all profile updates.
4. **Duplicate subscription protection** — Server-side check in `create-checkout-session` throws if `subscription_status === 'active'`; client-side `startCheckout()` redirects to billing portal if already Pro.

---

---

## Session 4: Admin Panel

### What was added

- **Admin panel** at `/admin` — sortable, filterable user management table with inline row actions
- **`is_admin` + `is_active` columns** added to `public.profiles`
- **`get_task_counts_by_user()` RPC** — `SECURITY DEFINER` Postgres function for cross-user task count aggregation
- **Six admin Edge Functions** — `get-admin-users`, `admin-deactivate-user`, `admin-activate-user`, `admin-reset-password`, `admin-create-user`, `admin-set-admin`; all deployed `--no-verify-jwt`
- **`isAdmin` computed signal** in `SubscriptionService`
- **`is_active` check on login** in `AuthService.signIn()` — deactivated users are signed out immediately with an error message
- **`adminGuard`** — waits for both `authLoading` and `profileLoading` using `combineLatest`, redirects non-admins to `/active`
- **`AdminService`** — signal-based service with `users`, `loading`, `error` signals and action methods
- **Admin page** — sortable table, toolbar (search + 2 filters + create button), confirmation dialog for destructive actions, "Back to app" button; tab bar hidden on admin routes
- **`ConfirmDialogComponent`** — reusable confirmation modal
- **`AdminCreateUserDialogComponent`** — email + password create-user form
- **Admin Panel link** in `UserMenuComponent` — only shown when `isAdmin()` is true

### New files added

| File | Purpose |
|------|---------|
| `supabase/functions/get-admin-users/index.ts` | Full user list with profiles + task counts |
| `supabase/functions/admin-deactivate-user/index.ts` | Deactivate + cancel Stripe at period end |
| `supabase/functions/admin-activate-user/index.ts` | Reactivate account |
| `supabase/functions/admin-reset-password/index.ts` | Send password reset email |
| `supabase/functions/admin-create-user/index.ts` | Create new auth user |
| `supabase/functions/admin-set-admin/index.ts` | Promote/demote admin (blocks self-demotion) |
| `src/app/guards/admin.guard.ts` | Route guard for /admin |
| `src/app/services/admin.service.ts` | Admin data + action methods |
| `src/app/pages/admin/admin.ts/html/scss` | Admin page: sortable user table + filters + actions |
| `src/app/components/confirm-dialog/` | Reusable confirmation modal |
| `src/app/components/admin-create-user-dialog/` | Create user modal |

### Files modified

| File | Change |
|------|--------|
| `src/app/services/subscription.service.ts` | Added `is_admin` to Profile interface, added `isAdmin` computed signal |
| `src/app/services/auth.service.ts` | `signIn()` checks `is_active` after login, signs out + returns error if deactivated |
| `src/app/guards/pro.guard.ts` | Switched to `combineLatest` to fix race condition on hard refresh |
| `src/app/app.routes.ts` | Added `/admin` lazy-loaded route with `adminGuard` |
| `src/app/app.ts` | Added `isAdminRoute` signal |
| `src/app/app.html` | Tab bar wrapped in `@if (!isAdminRoute())` |
| `src/app/components/user-menu/user-menu.ts/html` | Added `goToAdmin()` method + "Admin Panel" button for admins |

### Bugs fixed in Session 4

1. **`shield_outlined` not a valid Material Symbols icon** — rendered as literal text in action buttons for non-admin user rows. Fixed by using `shield` for both states and toggling an `.is-admin` CSS class for visual differentiation.
2. **Hard refresh on `/admin` redirected to `/active`** — race condition in `adminGuard` where `authLoading` resolved before the `profileLoading` observable chain subscribed. Fixed by replacing sequential `switchMap` chain with `combineLatest` waiting for both signals simultaneously.

---

## Current State

- **Build:** Clean, compiles without errors
- **Dev server:** `ng serve` on port 4200
- **All core features implemented and working**
- **Auth:** Email/password via Supabase; deactivated users blocked at login
- **Persistence:** Supabase PostgreSQL with RLS
- **Billing:** Stripe subscriptions live (sandbox mode); webhook verified working
- **Admin:** Fully functional admin panel with user management, subscription visibility, account activation/deactivation, password reset, user creation, admin promotion
- **No tests written yet** (Vitest is configured but no specs beyond the default)

---

## Running the App

### Prerequisites
1. Supabase project with the DB schema from `01-data-model.md` applied, plus the `profiles` table from `11-stripe-billing.md`
2. `src/environments/environment.ts` filled with your project URL and anon key
3. `http://localhost:4200/login` added to Supabase Redirect URLs (for password reset)
4. Email confirmation disabled in Supabase → Auth → Providers → Email (optional but recommended for local dev)
5. Supabase secrets set: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`
6. Stripe webhook endpoint registered pointing to the `stripe-webhook` Edge Function URL

### Start dev server
```bash
cd "C:\Users\Edgar Kilamyan\Desktop\To Do\to-do-angular"
npx ng serve
```

---

## Potential Next Steps

- Write unit tests with Vitest
- Write Playwright end-to-end tests
- Add task search/filter by title or assignee
- Add due date reminders/notifications
- Add task notes/comments
- Export tasks to CSV/JSON
- Add keyboard shortcuts (Ctrl+N for new task, etc.)
- Responsive design improvements for mobile
- Add animations for tab transitions
- Bulk actions (delete all, complete all)
- User profile page (change email/password)
- Multiple workspaces / projects
- Annual billing option (Stripe)
- Free trial period

---

## Reproducing the Agent Workflow

To use the same multi-agent approach for future features:
1. **Designer Agent** — creates/updates SCSS and HTML templates
2. **Coder Agent** — builds TypeScript logic, reads existing SCSS for class names
3. **Code Reviewer Agent** — reads all files, finds bugs, fixes them, runs build
4. **Tester Agent** — builds and optionally runs Playwright tests

Give each agent a detailed prompt with file paths, feature specs, and the CSS classes/patterns to follow.
