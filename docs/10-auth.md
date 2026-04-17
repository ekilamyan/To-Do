# Authentication & Supabase Integration

## Overview

Authentication is handled by Supabase Auth (email/password). All task and assignee data is stored in Supabase PostgreSQL with Row Level Security (RLS), meaning each user can only read and write their own records.

## Supabase Setup

### Required configuration

1. Create a Supabase project and run the SQL schema (see `01-data-model.md`)
2. Set credentials in `src/environments/environment.ts`:
   ```typescript
   export const environment = {
     supabase: {
       url: 'https://your-project.supabase.co',
       anonKey: 'eyJ...'
     }
   };
   ```
3. Add `http://localhost:4200/login` to **Auth → URL Configuration → Redirect URLs** (required for password reset emails)
4. To skip email confirmation: **Auth → Providers → Email → uncheck "Confirm email"**

### Supabase client

`src/app/core/supabase.client.ts` creates a single `SupabaseClient` instance via an Angular `InjectionToken`:

```typescript
export const SUPABASE_CLIENT = new InjectionToken<SupabaseClient>('SupabaseClient');
export function provideSupabaseClient() { ... }
```

Registered in `app.config.ts` via `provideSupabaseClient()`. Both `AuthService` and `TaskService` inject `SUPABASE_CLIENT`.

Client is initialized with:
- `persistSession: true` — session survives page refresh (stored in localStorage by Supabase SDK)
- `autoRefreshToken: true` — silently refreshes JWTs before expiry
- `detectSessionInUrl: true` — handles password reset redirect links

## AuthService (`src/app/services/auth.service.ts`)

Signal-based service that wraps Supabase Auth.

### Signals

| Signal | Type | Description |
|--------|------|-------------|
| `session` | `Signal<Session \| null>` | Current Supabase session |
| `user` | `Signal<User \| null>` | Current user object |
| `userEmail` | `Signal<string \| null>` | Computed from `user` |
| `isLoggedIn` | `Signal<boolean>` | Computed: `session !== null` |
| `authLoading` | `Signal<boolean>` | True until initial `getSession()` resolves |

### Constructor lifecycle

1. Calls `supabase.auth.getSession()` to resolve any existing session on page load → sets `authLoading(false)`
2. Subscribes to `onAuthStateChange` → keeps all signals in sync for all future auth events (login, logout, token refresh, password reset)
3. Signals are **never set manually by method calls** — `onAuthStateChange` is the single source of truth

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `signIn(email, password)` | `Promise<AuthError \| null>` | Email/password sign in; checks `is_active` after success — signs out + returns error if deactivated |
| `signUp(email, password)` | `Promise<{ error, needsConfirmation }>` | Create account; `needsConfirmation: true` if email confirmation is required |
| `resetPassword(email)` | `Promise<AuthError \| null>` | Sends password reset email |
| `signOut()` | `Promise<void>` | Signs out, clears session |

## TaskService — Auth Lifecycle

`TaskService` watches `authService.isLoggedIn()` via an Angular `effect()`:

- **On login** → fetches all tasks and assignees from Supabase
- **On logout** → clears the tasks map and assignee pool signals immediately

This means tasks are scoped to the logged-in user and never bleed between sessions.

## Auth Guards

### `authGuard` (`src/app/guards/auth.guard.ts`)

Applied to `/active`, `/completed`, `/deleted`. Redirects to `/login` if no session exists.

Handles the cold-start case (hard refresh) by waiting for `authLoading` to resolve before making the decision, using `toObservable(authLoading).pipe(filter(l => !l), take(1))`.

### `loginRedirectGuard` (`src/app/guards/login-redirect.guard.ts`)

Applied to `/login`. Redirects already-authenticated users to `/active` so they skip the login page.

### `adminGuard` (`src/app/guards/admin.guard.ts`)

Applied to `/admin`. Uses `combineLatest` to wait for both `authLoading` and `profileLoading` to resolve, then checks `subscriptionService.isAdmin()`. Redirects non-admins to `/active`. See `12-admin-panel.md` for full details.

## Login Page (`src/app/pages/login/`)

Single component (`LoginComponent`) with three views controlled by `view = signal<'login' | 'signup' | 'forgot'>('login')`.

### Views

| View | Fields | Action |
|------|--------|--------|
| `login` | Email, Password | Signs in → navigates to `/active` |
| `signup` | Email, Password, Confirm Password | Creates account → navigates to `/active` (or shows "check email" if confirmation required) |
| `forgot` | Email | Sends password reset email → shows success/error message |

### Forms

Uses Angular `ReactiveFormsModule`. Each view has its own `FormGroup`:
- `loginForm`: email (required, email) + password (required, minLength 8)
- `signupForm`: email + password + confirmPassword with cross-field `passwordMatchValidator`
- `forgotForm`: email only

### Password visibility

Each password field has an eye toggle button that switches between `type="password"` and `type="text"`. Controlled by `showLoginPassword`, `showSignupPassword`, `showSignupConfirm` signals.

### Styling

Matches the app's design system exactly:
- Full-screen centered card on `--bg-secondary` background
- "Taskflow" title with the same accent dot brand mark as the main header
- Inputs use identical focus ring (`--accent` border + `--accent-glow` box-shadow)
- Primary button uses `--accent` / `--accent-hover`
- Supports dark mode via CSS variables

## Header Auth UI (`src/app/app.html`)

When on any non-login route, the header shows:
- Logged-in user's email (`authService.userEmail()`) — truncated with `text-overflow: ellipsis`
- "Sign out" button → calls `authService.signOut()` → navigates to `/login`

The entire `<header>` and `<nav>` are wrapped in `@if (!isLoginRoute())` so the login page renders full-screen without the app chrome.

## Session Persistence

- Supabase SDK stores the session JWT in `localStorage` automatically (key: `sb-*-auth-token`)
- On page reload, `AuthService` calls `getSession()` which reads from localStorage and validates the token
- If the token is expired but a refresh token exists, Supabase silently refreshes it
- If the refresh fails, `onAuthStateChange` fires `SIGNED_OUT` and the guard redirects to `/login`

## Row Level Security

All tables have RLS enabled. A Postgres trigger (`set_user_id()`) automatically sets `user_id = auth.uid()` on every INSERT, so the client never needs to send the user ID explicitly.

Policies:
- `tasks`: SELECT/INSERT/UPDATE/DELETE all require `auth.uid() = user_id`
- `assignees`: ALL operations require `auth.uid() = user_id`
