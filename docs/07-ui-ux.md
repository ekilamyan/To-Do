# UI / UX Specifications

## Design Language

Modern, clean, Asana-inspired layout with a contemporary feel. Rounded edges on cards, buttons, pills, and inputs. Supports **dark and light modes** (see [08-theming.md](08-theming.md)). Subtle shadows for depth. Clear visual hierarchy.

## Fonts

- **Body:** Plus Jakarta Sans (Google Fonts) -- 400, 500, 600, 700 weights
- **Headings:** Sora (Google Fonts) -- 400, 500, 600, 700 weights
- Loaded via `@import url()` in `styles.scss` and preconnected in `index.html`

## Color Palette

All colors use CSS custom properties (`var(--token)`) for theme support.

### Base Colors (Light Mode)

| Element              | Token              | Value     |
|----------------------|--------------------|-----------|
| Background (main)    | `--bg-primary`     | `#ffffff` |
| Background (alt)     | `--bg-secondary`   | `#f6f6f6` |
| Table header bg      | `--bg-table-header`| `#fafafa` |
| Creation row bg      | `--bg-creation-row`| `#fafbfd` |
| Row hover            | `--bg-hover`       | `#f0f4ff` |
| Text (primary)       | `--text-primary`   | `#1e1e1e` |
| Text (secondary)     | `--text-secondary` | `#6d6d6d` |
| Text (placeholder)   | `--text-placeholder`| `#a0a0a0`|
| Border               | `--border-color`   | `#e8e8e8` |
| Accent               | `--accent`         | `#4573d2` |

### Priority Colors (Shared)

| Priority | Token               | Color     | Display     |
|----------|---------------------|-----------|-------------|
| None     | `--priority-none`   | `#9e9e9e` | Gray pill   |
| Low      | `--priority-low`    | `#4ecdc4` | Teal pill   |
| Medium   | `--priority-medium` | `#f9a825` | Amber pill  |
| High     | `--priority-high`   | `#ff6b35` | Orange pill |
| Urgent   | `--priority-urgent` | `#e53935` | Red pill    |

### Status Colors (Shared)

| Element            | Token             | Color     |
|--------------------|-------------------|-----------|
| Complete (checked) | `--complete-green` | `#58a65c` |
| Overdue date       | `--overdue-red`   | `#e53935` |

## Component Specifications

### App Header
- Flex row, space-between, max-width 1440px centered
- Left: "Taskflow" title in Sora 18px bold with orange accent dot
- Right: Header actions group (flex, gap 12px):
  - **"+ Task" button** (active tab only): accent background, white text, 13px 600 weight, 6px 14px padding, 8px border-radius
  - Theme toggle button

### Theme Toggle
- 40x40px button, 8px border-radius
- Sun icon (light mode) / Moon icon (dark mode) via SVG
- Hover: accent-colored background, active: rotates icon 30deg

### Tab Bar
- Height: 48px, flex row
- Active tab: bold text + 2px accent bottom border
- Count badge: 12px text in rounded pill (`--bg-secondary` background)
- Hover on inactive: text-primary color + bg-hover

### Table Container
- 12px border-radius, 1px border, subtle box-shadow
- Sticky header row at top of scroll area

### Table Header Row
- Height: 36px, bg: `--bg-table-header`
- Text: 12px uppercase semibold
- Sortable columns show cursor pointer + arrow icon
- Sort icon rotates 180deg for descending

### Task Row
- Grid: `44px 34px 1fr 1fr 120px 140px 150px 72px`
- Min-height: 44px, center-aligned
- Hover: `--bg-hover` background, action buttons become visible
- **Complete button:** 20px circle, 2px border, green fill + checkmark when completed, hover reveals checkmark
- **Expand chevron:** Rotates 90deg when expanded
- **Edit button:** Pencil icon, visible on hover, accent color when active
- **Delete button:** Trash icon, visible on hover
- **Restore button:** Always visible on completed/deleted tabs

### Task Row Edit Mode
- Toggled via edit button (pencil -> checkmark icon)
- Row background: `--bg-creation-row` with left accent border (2px inset)
- **All fields show as full input fields** matching creation row style
- Inputs: 1px border `--border-color`, 6px radius, focus glow (accent + shadow)
- Works on ALL tabs (active, completed, deleted)

### Subtask Row
- Same as task row but with **28px left indent** on the title cell
- No expand chevron
- Subtask count badge on parent: small rounded pill next to title

### Inline Creation Row
- **Conditional** -- appears at bottom of task list when user clicks "+ Task" or "+ Subtask"
- Only on active tab. Disappears after saving or cancelling.
- Min-height: 48px, bg: `--bg-creation-row`
- **All fields always visible** as styled input fields with visible borders
- Inputs: 1px border `--border-color`, 6px radius, bg `--bg-primary`
- Focus: accent border + box-shadow glow
- **Save button** in action column: accent background, white text, 12px 600 weight
- Border-bottom: 1px solid (not dashed)

### Snackbar
- Fixed position: bottom-center of screen (bottom: 24px, centered horizontally)
- Background: `var(--text-primary)`, text: `var(--bg-primary)`, 13px 500 weight
- Border-radius: `var(--radius)`, shadow: `var(--shadow-lg)`
- Slide-up animation on entry (200ms ease-out)
- Dismiss button (X) on the right side
- Auto-dismisses after 3 seconds
- z-index: 1000

### Drag Handle
- 6-dot grip icon (12px, two columns of three dots)
- Positioned at left edge of task row, absolute
- Hidden by default (opacity 0), visible on row hover
- Color: `var(--text-placeholder)`, darkens on hover
- Cursor: grab (grabbing when active)

### Priority Pill
- Inline-flex, 12px border-radius, 12px semibold white text
- Background uses priority CSS variable color

### Due Date
- Format: `Mar 29, 2026`
- Overdue: `--overdue-red` + font-weight 600
- Date picker: custom styled to match app (appearance: none, custom calendar icon, accent focus)
- Dark mode: calendar icon inverted for visibility

### Assignee
- Text input with HTML `<datalist>` for searchable dropdown
- Type new name to add to pool, select existing from list
- Unique datalist IDs per row to avoid collisions

### Empty State
- Centered in table area with icon + message text
- Active: clipboard icon + "No tasks yet. Click + Task to get started!"
- Completed: checkmark icon + "No completed tasks yet"
- Deleted: trash icon + "Trash is empty"

## Border Radius

| Element          | Radius |
|------------------|--------|
| Buttons          | 8px    |
| Input fields     | 6px    |
| Priority pills   | 12px   |
| Table container  | 12px   |
| Count badges     | 10px   |
| Expand chevron   | 4px    |

## Animations

| Animation               | Duration | Effect                       |
|-------------------------|----------|------------------------------|
| Task completion/delete  | 200ms    | Row fades out (opacity + translateY) |
| New task created        | 150ms    | Row fades in                 |
| Subtask expand          | 150ms    | Slide down                   |
| Subtask collapse        | 150ms    | Slide up                     |
| Cell focus transition   | 100-150ms| Border color + box-shadow    |
| Chevron rotation        | 200ms    | Rotate 90deg                 |
| Button hover            | 150ms    | Opacity + color transition   |
| Drag reorder            | 200ms    | Transform transition for reflow |
| Snackbar entry          | 200ms    | Slide-up + fade-in           |

## Accessibility

- All interactive elements are **keyboard navigable**
- **Tab key** moves between fields
- **Enter** activates edit mode or confirms
- **Escape** cancels edit
- ARIA roles applied: table structure implied via grid layout
- Complete and delete buttons have `title` attributes
- Color is **never the sole indicator** -- priority has text labels alongside colors
- Focus indicators: visible accent border + box-shadow glow
- Date picker icon visible in both light and dark modes
- Sufficient color contrast (WCAG AA minimum)

## Page Layout

```
+----------------------------------------------------------+
|  Taskflow                          [+ Task] [sun/moon]    |  <- Header
+----------------------------------------------------------+
|  Active (12)  |  Completed (5)  |  Deleted (2)           |  <- Tab bar
+----------------------------------------------------------+
| [table container with rounded corners + shadow]           |
|  [ ] > Title     | Description | Priority | Date | Assign | Actions |  <- Header
|  O > Task One    | Desc...     | [High]   | Mar 29 | Alice| [+][e][x] <- Task row
|      Subtask 1   | ...         | [Low]    | Apr 1  | Bob  | [e][x]  |  <- Subtask
|  O > Task Two    | Desc...     | [None]   | Apr 5  | Carol| [+][e][x] <- Task
|  + Add a task... | Desc...     | [none v] | [date] | Name | [Save]  |  <- Creation row (conditional)
+----------------------------------------------------------+
```

## Cross-references

- Component structure: [00-overview.md](00-overview.md)
- Table layout: [03-task-table.md](03-task-table.md)
- Priority definitions: [01-data-model.md](01-data-model.md)
- Theming / dark mode: [08-theming.md](08-theming.md)
