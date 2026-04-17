# Admin Panel

## Overview

The admin panel lives at `/admin` inside the same Angular app. Admins log in via the normal login page — admin accounts are also regular user accounts. The panel provides a sortable, filterable user management table with inline row actions.

Admin identity is stored as `is_admin BOOLEAN` in the `profiles` table. A user with `is_admin = TRUE` sees an **Admin Panel** link in the user menu dropdown and can navigate to `/admin`.

---

## Database

Two columns were added to `public.profiles`:

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
```

A `SECURITY DEFINER` RPC function enables cross-user task count aggregation (bypasses RLS):

```sql
CREATE OR REPLACE FUNCTION get_task_counts_by_user()
RETURNS TABLE(user_id UUID, active_count BIGINT, completed_count BIGINT)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    user_id,
    COUNT(*) FILTER (WHERE status = 'active'    AND parent_id IS NULL) AS active_count,
    COUNT(*) FILTER (WHERE status = 'completed' AND parent_id IS NULL) AS completed_count
  FROM tasks
  GROUP BY user_id;
$$;
```

Grant admin to a user:
```sql
UPDATE public.profiles SET is_admin = TRUE WHERE id = 'user-uuid-here';
```

---

## Edge Functions

Six Edge Functions handle all admin operations. All deployed with `--no-verify-jwt`.

| Function | Accepts | What it does |
|----------|---------|-------------|
| `get-admin-users` | — | `auth.admin.listUsers()` + join profiles + `rpc('get_task_counts_by_user')` → merged array |
| `admin-deactivate-user` | `{ userId }` | Sets `is_active=false, subscription_status='free'`; calls `stripe.subscriptions.update(id, { cancel_at_period_end: true })` if Stripe subscription exists |
| `admin-activate-user` | `{ userId }` | Sets `is_active=true` (Stripe untouched) |
| `admin-reset-password` | `{ email, origin }` | Calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + '/login' })` |
| `admin-create-user` | `{ email, password }` | Calls `auth.admin.createUser({ email, password, email_confirm: true })`; the `handle_new_user` trigger auto-creates the profiles row |
| `admin-set-admin` | `{ userId, isAdmin }` | Updates `profiles.is_admin`; guards against self-demotion |

Every function verifies the caller is an admin by: reading the `Authorization` header → `supabaseUser.auth.getUser()` → checking `profiles.is_admin = true` for that user ID.

Deploy commands:
```bash
supabase functions deploy get-admin-users --no-verify-jwt
supabase functions deploy admin-deactivate-user --no-verify-jwt
supabase functions deploy admin-activate-user --no-verify-jwt
supabase functions deploy admin-reset-password --no-verify-jwt
supabase functions deploy admin-create-user --no-verify-jwt
supabase functions deploy admin-set-admin --no-verify-jwt
```

---

## Angular Architecture

### SubscriptionService changes

`is_admin` was added to the `Profile` interface and a new computed signal was added:

```typescript
readonly isAdmin = computed(() => this.profile()?.is_admin === true);
```

`select('*')` already fetches all profile columns, so no query change was needed.

### AuthService — `is_active` check

`signIn()` now checks `is_active` after a successful password sign-in:

```typescript
const { data: profile } = await this.supabase.from('profiles').select('is_active').single();
if (profile?.is_active === false) {
  await this.supabase.auth.signOut();
  return { message: 'Your account has been deactivated. Please contact support.' } as AuthError;
}
```

The login page already displays `error.message`, so deactivated users see the message without any template changes.

### adminGuard (`src/app/guards/admin.guard.ts`)

Same pattern as `proGuard`. Uses `combineLatest` to wait for both `authLoading` and `profileLoading` to resolve before checking `isAdmin()`. Redirects to `/active` for non-admins.

```typescript
return combineLatest([
  toObservable(auth.authLoading),
  toObservable(sub.profileLoading),
]).pipe(
  filter(([authL, profileL]) => !authL && !profileL),
  take(1),
  map(() => sub.isAdmin() ? true : router.createUrlTree(['/active'])),
);
```

`combineLatest` (vs the previous sequential chain) prevents a race condition where `authLoading` resolves first but `profileLoading` hasn't started changing yet.

### AdminService (`src/app/services/admin.service.ts`)

Signal-based service with `users`, `loading`, and `error` signals.

```typescript
interface AdminUser {
  id: string;
  email: string;
  createdAt: string;
  isAdmin: boolean;
  isActive: boolean;
  subscriptionStatus: 'free' | 'active' | 'canceled';
  subscriptionEndDate: string | null;
  stripeSubscriptionId: string | null;
  activeTasks: number;
  completedTasks: number;
}
```

Methods: `loadUsers()`, `deactivateUser(userId)`, `activateUser(userId)`, `resetPassword(email)`, `createUser(email, password)`, `setAdmin(userId, isAdmin)`. Each action method invokes its Edge Function then calls `loadUsers()` to refresh the table.

### Route

```typescript
{
  path: 'admin',
  loadComponent: () => import('./pages/admin/admin').then(m => m.AdminComponent),
  canActivate: [authGuard, adminGuard]
}
```

### App shell changes

`isAdminRoute` signal added to `app.ts` (same pattern as `isLoginRoute`). The tab bar is hidden on admin routes:

```html
@if (!isAdminRoute()) {
  <nav class="app-nav">
    <app-tab-bar />
  </nav>
}
```

The header (with UserMenu and ThemeToggle) still shows on admin pages.

---

## Admin Page (`src/app/pages/admin/`)

### Toolbar

- **Search input** — filters users by email client-side
- **Plan filter** dropdown — All / Free / Pro / Canceled
- **Status filter** dropdown — All / Active / Inactive
- **Create User** button — opens `AdminCreateUserDialogComponent`
- **← Back to app** button — navigates to `/active`

### Table columns

| Column | Notes |
|--------|-------|
| Email | + amber "Admin" badge if `isAdmin` |
| Signed up | Formatted date |
| Status | Green "Active" / Red "Inactive" pill |
| Plan | Free / Pro / Canceled pill |
| Next renewal | Formatted date or "—" |
| Active | Task count (right-aligned, tabular nums) |
| Done | Completed task count |
| Actions | Always-visible icon buttons |

All columns are sortable (click header to cycle: asc → desc → off). Sort indicator uses `▲` triangle, accent-colored when active, rotated 180° for descending — same as the task table.

### Action buttons (always visible)

| Button | Icon | Action | Guard |
|--------|------|--------|-------|
| Deactivate | `block` | Opens confirm dialog → deactivates + cancels Stripe | Disabled for own account |
| Activate | `check_circle` | Opens confirm dialog → reactivates | — |
| Reset password | `lock_reset` | Opens confirm dialog → sends reset email | — |
| Toggle admin | `shield` | Opens confirm dialog → promotes or demotes | Disabled for own account; accent-colored when user is already admin |

### `filteredUsers` computed signal

Applies search, plan filter, status filter, and sort in sequence against `adminService.users()`.

### Confirmation dialog

Destructive actions set a `pendingAction` signal. The `ConfirmDialogComponent` renders with contextual title, message, and button label. Cancelling clears the signal; confirming calls the relevant `AdminService` method.

---

## Components

### ConfirmDialogComponent (`src/app/components/confirm-dialog/`)

Reusable modal for destructive confirmations.

| Input | Type | Description |
|-------|------|-------------|
| `title` | `string` | Dialog heading |
| `message` | `string` | Body text |
| `confirmLabel` | `string` | Confirm button label (default: "Confirm") |

Outputs: `confirmed`, `cancelled`. Confirm button is red; cancel is a bordered ghost button.

### AdminCreateUserDialogComponent (`src/app/components/admin-create-user-dialog/`)

Email + password form. Calls `adminService.createUser()` on submit. Emits `closed` output on success or cancel. Shows inline error message if the Edge Function returns an error.

### UserMenu — Admin Panel link

An "Admin Panel" button appears in the dropdown for users where `subscriptionService.isAdmin()` is true:

```html
@if (subscriptionService.isAdmin()) {
  <button class="dropdown-btn admin-btn" (click)="goToAdmin()">
    <span class="material-symbols-rounded btn-icon">admin_panel_settings</span>
    Admin Panel
  </button>
}
```

---

## Security

- Every Edge Function re-verifies the caller's `is_admin` status server-side — the Angular guard is UI-only
- `admin-set-admin` prevents self-demotion: `if (userId === callerId && !isAdmin) throw Error(...)`
- The `authGuard` always runs before `adminGuard` — unauthenticated users are redirected to `/login` first
- Deactivated users (`is_active = false`) are signed out immediately on login with a clear error message
- The admin `select('*')` queries use the service role key (bypasses RLS) inside Edge Functions; the Angular client never touches other users' data directly
