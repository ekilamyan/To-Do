# Task Table & Inline Creation

## Table Layout

The table is the primary UI element, modeled after Asana's list view. It is full-width and occupies the main content area below the tab bar. Wrapped in a container with 12px border-radius and subtle shadow.

### Column Definitions

| # | Column        | Width     | Sortable | Notes                                      |
|---|---------------|-----------|----------|--------------------------------------------|
| 1 | Complete      | 44px      | No       | Circle checkbox icon                       |
| 2 | Expand        | 34px      | No       | Chevron, visible on active tab (always) or if task has subtasks |
| 3 | Title         | Flexible  | Yes      | Largest column, primary identifier         |
| 4 | Description   | Flexible  | Yes      | Secondary text, truncated with ellipsis    |
| 5 | Priority      | 120px     | Yes      | Colored pill/badge                         |
| 6 | Due Date      | 140px     | Yes      | Formatted date, red if overdue             |
| 7 | Assignee      | 150px     | Yes      | Text name                                  |
| 8 | Actions       | 72px      | No       | Edit, add subtask, delete/restore buttons  |

Grid: `44px 34px 1fr 1fr 120px 140px 150px 72px`

### Header Row

- Sticky at the top of the scroll container
- Column names are clickable for sorting (see [05-sorting.md](05-sorting.md))
- Sort direction indicator (arrow icon) appears next to the active sort column
- Background: `var(--bg-table-header)`, text: 12px uppercase semibold

## "+ Task" Button

- Located in the **app header** (top-right, next to the theme toggle)
- **Only visible on the active tab**
- Clicking it triggers a conditional inline creation row at the bottom of the task list
- Styled with accent background, white text, 600 font weight

## TaskTableComponent

Reusable component shared across all three tab pages.

**Inputs:**
- `tasks` -- Task array from the parent page
- `tabType` -- `'active' | 'completed' | 'deleted'` -- controls available actions

**Behavior by tab:**

| Feature              | Active | Completed | Deleted |
|----------------------|--------|-----------|---------|
| Complete button      | Yes    | Checked (non-interactive) | Permanent delete (X) |
| Edit button          | Yes    | Yes       | Yes     |
| + Subtask button     | Yes (parent tasks only) | No | No |
| Delete button        | Yes    | No        | No      |
| Restore button       | No     | Yes (always visible) | Yes (always visible) |
| Inline creation row  | Conditional (via + Task button) | No  | No |
| Sorting              | Yes    | Yes       | Yes     |
| Expand/collapse      | Yes    | Yes       | Yes     |
| Drag-and-drop        | Yes (when no column sort active) | No | No |

## Inline Creation Row

**Conditional** -- appears at the bottom of the task list when the user clicks "+ Task" (or "+ Subtask" on a parent row). Only on the active tab.

### Visual Design
- Same grid as task rows
- Background: `var(--bg-creation-row)`
- Border-bottom: 1px solid
- All fields are **always visible** as input fields with visible borders
- Inputs match the app's styling: 1px border, 6px border-radius, focus glow
- Slightly taller than regular rows (48px min-height)
- **Save button** in the action column to explicitly commit the task

### Fields Always Shown
- Title input: placeholder "Add a task..." (or "Add subtask..." for subtask creation)
- Description input: placeholder "Description..."
- Priority select: dropdown with all priority values
- Due Date: styled date picker
- Assignee input: with datalist for existing assignee pool

### Behavior

1. User clicks "+ Task" button in the header
2. Inline creation row appears at the bottom of the task list with title auto-focused
3. User can Tab between fields to fill in multiple values
4. When Title is non-empty and user clicks Save or presses Enter:
   - Task is created via `TaskService.createTask()`
   - New task appears in the task list
   - Creation row disappears
5. If user presses Escape or clicks away with empty title:
   - Draft is discarded, creation row disappears

### Keyboard Navigation
- **Tab:** Move to next field
- **Shift+Tab:** Move to previous field
- **Enter:** Save the task (if Title is filled)
- **Escape:** Cancel and dismiss the creation row

## Drag-and-Drop Reordering

- Tasks can be **dragged to reorder** within the task list (active tab only)
- Subtasks can be reordered within their parent (same-level only, no cross-parent moves)
- Uses Angular CDK `cdkDropList` and `cdkDrag` directives
- **Drag handle** (6-dot grip icon) appears on hover, positioned at the left edge of the row
- Drag is **disabled** when a column sort is active (sort and manual order would conflict)
- Order is persisted via `sortOrder` field on each task, saved to localStorage
- When no column sort is active, tasks display in `sortOrder` (descending) order

### Drag Visual States
- **Preview**: Row-like appearance with accent border + elevated shadow
- **Placeholder**: Semi-transparent with dashed accent border
- **Animation**: 200ms ease transition for reflow

## Cross-references

- Sorting behavior: [05-sorting.md](05-sorting.md)
- Subtask rows: [04-subtasks.md](04-subtasks.md)
- Visual design details: [07-ui-ux.md](07-ui-ux.md)
