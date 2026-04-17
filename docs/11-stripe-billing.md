# Stripe Billing & Freemium Subscription

## Overview

Taskflow uses a **freemium model** — all users get the Active tab for free; a **$5/month Pro subscription** unlocks Completed + Deleted tabs, dark mode, and priority editing. Billing is handled entirely through Stripe, with server-side logic in Supabase Edge Functions.

---

## Subscription Tiers

| Feature | Free | Pro |
|---------|------|-----|
| Active tasks (create, edit, delete) | ✓ | ✓ |
| Completed tab | ✗ | ✓ |
| Deleted tab + restore | ✗ | ✓ |
| Dark mode toggle | ✗ | ✓ |
| Priority field (view + edit) | ✗ | ✓ |

Locked features show a **PRO chip** and open a pricing dialog when clicked. Free users are forced to light mode on login.

---

## Database — `profiles` Table

```sql
CREATE TABLE public.profiles (
  id                     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  subscription_status    TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'active' | 'canceled'
  subscription_end_date  TIMESTAMPTZ
);
```

- Row Level Security enabled; users can SELECT their own row only
- Edge Functions use the service role key and bypass RLS
- A Postgres trigger (`handle_new_user`) auto-creates the row on signup

---

## Supabase Edge Functions

All three functions live in `supabase/functions/` and are deployed with `--no-verify-jwt` (they handle auth themselves via the `Authorization` header). CORS headers allow `authorization, content-type, x-client-info, apikey`.

### `create-checkout-session`

Called when a free user clicks "Upgrade Now".

1. Reads user from the JWT in the `Authorization` header
2. Checks `profiles.subscription_status` — throws if already `active` (prevents duplicate subscriptions)
3. Gets or creates a Stripe Customer for this user, stores `stripe_customer_id` in `profiles`
4. Creates a Stripe Checkout Session (`mode: subscription`, price from `STRIPE_PRICE_ID`)
5. Returns `{ url }` — client redirects to it

`success_url`: `{origin}/active?upgraded=true`
`cancel_url`: `{origin}/active`

### `stripe-webhook`

Receives events from Stripe (registered in Stripe Dashboard → Webhooks). Verifies the Stripe signature using `STRIPE_WEBHOOK_SECRET`.

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Sets `subscription_status = 'active'`, stores `stripe_subscription_id` + `subscription_end_date` |
| `customer.subscription.updated` | Syncs status using the mapping below |
| `customer.subscription.deleted` | Sets `subscription_status = 'canceled'`, clears `stripe_subscription_id` |

**Status mapping** (`customer.subscription.updated`):

| Stripe status | App status |
|---------------|------------|
| `active` | `active` |
| `trialing` | `active` |
| `past_due` | `active` (grace period) |
| `canceled` | `canceled` |
| `unpaid` | `canceled` |
| `incomplete` | `free` |
| `paused` | `canceled` |

### `create-portal-session`

Called when a Pro user clicks "Manage billing".

1. Reads user from JWT, looks up `stripe_customer_id` from `profiles`
2. Creates a Stripe Customer Portal session
3. Returns `{ url }` — client redirects to it

`return_url`: `{origin}/active`

### Deployment

```bash
supabase functions deploy create-checkout-session --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy create-portal-session --no-verify-jwt
```

### Required Supabase Secrets

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_...
supabase secrets set STRIPE_PRICE_ID=price_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## SubscriptionService (`src/app/services/subscription.service.ts`)

Signal-based service that loads and exposes the user's subscription state.

### Signals

| Signal | Type | Description |
|--------|------|-------------|
| `isPro` | `computed<boolean>` | `true` when `subscription_status === 'active'` |
| `subscriptionStatus` | `computed<string>` | Raw status: `'free'` \| `'active'` \| `'canceled'` |
| `subscriptionEndDate` | `computed<string \| null>` | ISO date of next billing cycle |
| `dialogOpen` | `signal<boolean>` | Controls global pricing dialog visibility |
| `profileLoading` | `signal<boolean>` | `true` until first profile fetch resolves |

### Constructor effect

Watches `authService.isLoggedIn()`:
- **Login** → calls `loadProfile()`
- **Logout** → clears profile signal, resets `profileLoading` to `true`

### Methods

| Method | Description |
|--------|-------------|
| `loadProfile()` | Fetches `profiles` row from Supabase; forces light mode if not Pro |
| `openPricingDialog()` / `closePricingDialog()` | Toggle `dialogOpen` |
| `startCheckout()` | Guards against existing Pro subscription, then invokes `create-checkout-session`, redirects to Stripe |
| `openBillingPortal()` | Invokes `create-portal-session`, redirects to Stripe portal |

**Double-subscription guard:** `startCheckout()` checks `isPro()` first — if already subscribed, it opens the billing portal instead of creating a new checkout session.

---

## Angular Components

### `ProChipComponent` (`src/app/components/pro-chip/`)

Reusable amber "PRO" badge. No inputs. Positioned absolutely by the parent using `.tab-pro-chip` or `.toggle-pro-chip` CSS classes. `pointer-events: none` so it doesn't block clicks.

### `PricingDialogComponent` (`src/app/components/pricing-dialog/`)

Global overlay rendered in `app.html`. Shown when `subscriptionService.dialogOpen()` is true.

- Semi-transparent backdrop (click to close)
- Centered card (max-width 440px) with feature comparison table
- "Upgrade Now" CTA → calls `subscriptionService.startCheckout()` with loading state
- Close button (top-right ✕)

### `UserMenuComponent` (`src/app/components/user-menu/`)

Replaces the old email + sign-out button in the app header. A button showing the user's email; clicking opens a dropdown.

**Dropdown contents:**
- Plan badge: "Free Plan" (gray) or "Pro Plan" (accent)
- If Pro: "Renews [date]" + "Manage billing" → opens Stripe portal
- If Free: "Upgrade to Pro" → opens pricing dialog
- Divider
- "Sign out" → signs out + navigates to `/login`

Outside-click closes the dropdown via `@HostListener('document:click')` + `ElementRef.contains()` check.

---

## Feature Locking

### Completed + Deleted tabs (`TabBarComponent`)

- `[class.locked]` applied when `!isPro()`
- Click intercepted: `e.preventDefault()` + `openPricingDialog()`
- `<app-pro-chip>` shown absolutely top-right of each tab label

### Dark mode toggle (`ThemeToggleComponent`)

- `onToggleClick()` opens dialog if `!isPro()` instead of toggling theme
- `<app-pro-chip>` shown top-right of the toggle button wrapper

### Priority header (`TaskTableComponent`)

- `<app-pro-chip>` rendered next to "Priority" column header when `!isPro()`

### Priority pill in task rows (`TaskRowComponent`)

- `onPriorityClick()`: opens dialog if `!isPro()`, else calls `startEdit('priority')`
- `.locked-cell` CSS class applied to the priority cell when `!isPro()`

### Priority select in creation row (`InlineCreationRowComponent`)

- `[disabled]="!subscriptionService.isPro()"` on the `<select>`
- `.locked` CSS class on the cell

---

## Route Guards

### `proGuard` (`src/app/guards/pro.guard.ts`)

Applied to `/completed` and `/deleted` routes (in addition to `authGuard`).

- Waits for both `authLoading` and `profileLoading` to resolve (handles cold-start / hard refresh)
- If `isPro()` → allows navigation
- Otherwise → redirects to `/active`

Pattern: `toObservable(authLoading).pipe(filter, take(1), switchMap(() => toObservable(profileLoading).pipe(filter, take(1), map(check))))`

---

## Post-Checkout Flow

After a successful Stripe payment, the user is redirected to `/active?upgraded=true`.

`ActiveComponent.ngOnInit()` detects the query param:
1. Calls `subscriptionService.loadProfile()` to pick up the updated subscription status
2. Shows snackbar: "Welcome to Taskflow Pro!"
3. Clears `?upgraded=true` from the URL (replaceUrl)

**Note:** There is a brief race window between the Stripe redirect and the webhook updating the database. If `loadProfile()` runs before the webhook fires, the status will still read `free`. Stripe retries failed webhooks automatically.

---

## Stripe Dashboard Setup

1. Create a Product ("Taskflow Pro") with a recurring $5/month Price → copy the Price ID
2. Add a webhook endpoint pointing to: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
3. Subscribe to: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Copy the webhook signing secret → set as `STRIPE_WEBHOOK_SECRET`
5. Enable Customer Portal in Stripe → Settings → Billing → Customer Portal
