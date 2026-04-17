# Theming (Dark / Light Mode)

## Overview

The app supports **dark mode** and **light mode**. The user's preference is persisted to localStorage and applied on load.

> **Dark mode is a Pro-only feature.** Free users are locked to light mode. The toggle button shows a PRO chip and opens the pricing dialog instead of toggling when the user is on the free tier. On login, `SubscriptionService` calls `ThemeService.setTheme('light')` for free users to enforce this.

## Toggle

- A toggle button (sun/moon icon) in the top-right corner of the page header
- **Pro users:** Clicking swaps between dark and light mode instantly
- **Free users:** Clicking opens the pricing dialog (no theme change)
- Default: follows the user's OS/browser preference (`prefers-color-scheme` media query)
- Once manually toggled by a Pro user, their choice overrides the OS preference

## Implementation

- CSS custom properties (variables) for all theme-dependent colors
- Variables defined on `:root` for light mode, overridden in a `.dark` class on `<html>`
- `ThemeService` manages the current theme signal and persists to localStorage key `todo-app-theme`
- `SubscriptionService` calls `ThemeService.setTheme('light')` after loading the profile when `!isPro()`

## Color Tokens

### Light Mode

| Token                    | Value     |
|--------------------------|-----------|
| `--bg-primary`           | `#ffffff` |
| `--bg-secondary`         | `#f6f6f6` |
| `--bg-table-header`      | `#fafafa` |
| `--bg-creation-row`      | `#fafbfd` |
| `--bg-hover`             | `#f0f4ff` |
| `--text-primary`         | `#1e1e1e` |
| `--text-secondary`       | `#6d6d6d` |
| `--text-placeholder`     | `#a0a0a0` |
| `--border-color`         | `#e8e8e8` |
| `--accent`               | `#4573d2` |

### Dark Mode

| Token                    | Value     |
|--------------------------|-----------|
| `--bg-primary`           | `#1a1a2e` |
| `--bg-secondary`         | `#16213e` |
| `--bg-table-header`      | `#1f2940` |
| `--bg-creation-row`      | `#1c2538` |
| `--bg-hover`             | `#253352` |
| `--text-primary`         | `#e0e0e0` |
| `--text-secondary`       | `#8a8a9a` |
| `--text-placeholder`     | `#5a5a6a` |
| `--border-color`         | `#2a2a3e` |
| `--accent`               | `#5b8cf7` |

### Shared (Same in Both Modes)

Priority colors, status colors (complete green, overdue red), and accent colors remain consistent across themes to maintain recognizability.

## ThemeService Contract

```typescript
@Injectable({ providedIn: 'root' })
class ThemeService {
  theme: signal<'light' | 'dark'>;   // Current theme
  isDark: computed<boolean>;          // Convenience computed

  toggleTheme(): void;               // Swap light <-> dark (called by Pro users only)
  setTheme(t: 'light' | 'dark'): void; // Directly set theme (used by SubscriptionService to force light for free users)
}
```

## Persistence

- Key: `todo-app-theme`
- Values: `"light"` or `"dark"`
- On load: check localStorage first, fall back to `prefers-color-scheme`
- Free users have their stored preference overridden to `"light"` on every login

## Cross-references

- Pro feature locking: [11-stripe-billing.md](11-stripe-billing.md)
- Base color palette: [07-ui-ux.md](07-ui-ux.md)
