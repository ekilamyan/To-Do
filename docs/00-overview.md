# Project Overview

## Purpose

An Asana-inspired task management single-page application built with Angular. The app provides a clean, modern table-based interface for managing tasks with support for subtasks, inline creation, sorting, edit mode, and status-based tab navigation with dark/light theming. Tasks are persisted to a Supabase PostgreSQL database, access is gated behind email/password authentication, and a Stripe-powered freemium subscription unlocks Pro features.

## Tech Stack

- **Framework:** Angular 21.2 (standalone components, signals)
- **Styling:** SCSS with CSS custom properties for theming
- **Fonts:** DM Sans (body) + Sora (headings) via Google Fonts
- **Testing:** Vitest + jsdom
- **Auth & Database:** Supabase (email/password auth, PostgreSQL with RLS)
- **Payments:** Stripe (subscriptions, Customer Portal, webhooks via Supabase Edge Functions)
- **Drag-and-drop:** Angular CDK
- **UI Library:** None — custom components throughout

## Architecture Decisions

- **State management:** Angular signals + `TaskService`, `SubscriptionService`, and `AdminService` (no NgRx/NgXS)
- **Component style:** Standalone components only (no NgModules)
- **Routing:** Three tab routes sharing a reusable `TaskTableComponent`, gated by auth + Pro guards; `/admin` lazy-loaded with `adminGuard`
- **Data structure:** Flat task map with parent/child ID references (not nested trees)
- **Theming:** CSS custom properties on `:root` (light) and `.dark` class, managed by `ThemeService`. Dark mode is a Pro-only feature.
- **Auth state:** Signal-based `AuthService` wrapping Supabase auth, drives TaskService load/clear lifecycle; checks `is_active` on sign-in
- **Subscription state:** Signal-based `SubscriptionService` loads `profiles` row on login, drives feature locking and admin access
- **Optimistic updates:** All task mutations update the signal immediately, then sync to Supabase asynchronously
- **Edge Functions:** Server-side Stripe and admin logic handled in Supabase Edge Functions (no separate backend)

## Folder Structure

```
src/
  environments/
    environment.ts               -- Supabase URL + anon key
  app/
    core/
      supabase.client.ts         -- InjectionToken for the SupabaseClient singleton
    models/
      task.model.ts              -- Task interface, Priority enum, TaskStatus enum, SortState
      mapper.ts                  -- camelCase <-> snake_case conversion (app model <-> DB row)
    services/
      task.service.ts            -- All task state, CRUD, and Supabase sync
      auth.service.ts            -- Auth state signals + signIn/signUp/signOut/resetPassword
      subscription.service.ts    -- Pro subscription state, dialog control, checkout/portal methods
      theme.service.ts           -- Dark/light mode management + localStorage
      snackbar.service.ts        -- Toast notifications
    guards/
      auth.guard.ts              -- Redirects unauthenticated users to /login
      login-redirect.guard.ts    -- Redirects authenticated users away from /login
      pro.guard.ts               -- Redirects free users away from /completed and /deleted
      admin.guard.ts             -- Redirects non-admins away from /admin
    services/
      admin.service.ts           -- Admin user data + action methods (loadUsers, deactivate, activate, etc.)
    components/
      theme-toggle/              -- Dark/light toggle (Pro-only; shows PRO chip + opens dialog for free users)
      tab-bar/                   -- Active / Completed / Deleted tabs (Completed + Deleted locked for free users)
      task-table/                -- Main table component (reused across tabs)
      task-row/                  -- Single task row (edit mode, inline-editable fields, priority locked for free users)
      inline-creation-row/       -- Row for adding new tasks/subtasks (priority disabled for free users)
      pro-chip/                  -- Reusable "PRO" badge shown on locked features
      pricing-dialog/            -- Global upgrade dialog with feature comparison table
      user-menu/                 -- Header dropdown: plan status, billing/upgrade, admin link, sign out
      confirm-dialog/            -- Reusable confirmation modal (used by admin page)
      admin-create-user-dialog/  -- Create user form modal (admin only)
      snackbar/                  -- Toast notification display
    pages/
      login/                     -- Login / sign-up / forgot-password (single component, 3 views)
      active/                    -- Active tasks page (handles ?upgraded=true post-checkout)
      completed/                 -- Completed tasks page (Pro only)
      deleted/                   -- Deleted tasks page (Pro only)
      admin/                     -- Admin panel: sortable user table, filters, row actions
supabase/
  functions/
    create-checkout-session/     -- Edge Function: creates Stripe Checkout Session
    stripe-webhook/              -- Edge Function: handles Stripe events, updates profiles table
    create-portal-session/       -- Edge Function: creates Stripe Customer Portal session
    get-admin-users/             -- Edge Function: returns all users with profiles + task counts
    admin-deactivate-user/       -- Edge Function: deactivates user + cancels Stripe at period end
    admin-activate-user/         -- Edge Function: reactivates user account
    admin-reset-password/        -- Edge Function: sends password reset email
    admin-create-user/           -- Edge Function: creates new auth user (email confirmed)
    admin-set-admin/             -- Edge Function: promotes or demotes admin (blocks self-demotion)
```

## Route Map

| Path | Component | Guards | Description |
|------|-----------|--------|-------------|
| `/` | Redirect | — | Redirects to `/active` |
| `/login` | `LoginComponent` | `loginRedirectGuard` | Auth page (lazy loaded) |
| `/active` | `ActiveComponent` | `authGuard` | Active tasks list |
| `/completed` | `CompletedComponent` | `authGuard`, `proGuard` | Completed tasks (Pro only) |
| `/deleted` | `DeletedComponent` | `authGuard`, `proGuard` | Deleted tasks (Pro only) |
| `/admin` | `AdminComponent` | `authGuard`, `adminGuard` | Admin panel (lazy loaded, admins only) |

## Document Index

| Document | Description |
|----------|-------------|
| [01-data-model.md](01-data-model.md) | Task interface, enums, service contract, DB schema |
| [02-task-management.md](02-task-management.md) | CRUD operations, edit mode, and edge cases |
| [03-task-table.md](03-task-table.md) | Table layout, columns, inline creation row |
| [04-subtasks.md](04-subtasks.md) | Subtask creation, expand/collapse, completion rules |
| [05-sorting.md](05-sorting.md) | Column sorting behavior |
| [06-tabs.md](06-tabs.md) | Tab navigation, routing, per-tab behavior |
| [07-ui-ux.md](07-ui-ux.md) | Visual design, colors, typography, animations |
| [08-theming.md](08-theming.md) | Dark/light mode toggle, CSS variables, ThemeService |
| [09-handoff.md](09-handoff.md) | Project history, agent workflow, and continuation guide |
| [10-auth.md](10-auth.md) | Supabase auth, login page, guards, session lifecycle |
| [11-stripe-billing.md](11-stripe-billing.md) | Stripe freemium integration, Edge Functions, SubscriptionService, feature locking |
| [12-admin-panel.md](12-admin-panel.md) | Admin panel, user management, Edge Functions, adminGuard, AdminService |
