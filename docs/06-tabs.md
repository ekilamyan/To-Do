# Tabs (Active, Completed, Deleted)

## Tab Bar

- Three tabs displayed horizontally at the top of the page: **Active**, **Completed**, **Deleted**
- Each tab shows a **count badge** with the number of top-level tasks in that status
  - Example: `Active (12)`, `Completed (5)`, `Deleted (2)`
  - Subtasks are NOT counted in the badge — only top-level tasks
- **Active** is the default tab (landing page)
- The tab bar is a standalone `TabBarComponent` using Angular Router links with `routerLinkActive`

> **Completed and Deleted are Pro-only tabs.** Free users see them in the tab bar but with a **PRO chip** and reduced opacity. Clicking either tab opens the pricing dialog instead of navigating. The routes are also guarded server-side by `proGuard`.

## Routing

| Path | Component | Guards | Description |
|------|-----------|--------|-------------|
| `/` | Redirect to `/active` | — | Default landing route |
| `/active` | `ActiveComponent` | `authGuard` | Active tasks |
| `/completed` | `CompletedComponent` | `authGuard`, `proGuard` | Completed tasks (Pro only) |
| `/deleted` | `DeletedComponent` | `authGuard`, `proGuard` | Deleted/trashed tasks (Pro only) |

Each page component:
1. Injects `TaskService`
2. Passes the appropriate computed task list to `TaskTableComponent`
3. Passes the `tabType` input to control available actions

## Tab-Specific Behavior

### Active Tab

- Displays tasks with `status === Active`
- **Complete button:** Visible and functional (circle checkbox)
- **Edit button:** Visible on hover (pencil icon)
- **Delete button:** Visible on hover (trash icon)
- **Inline creation row:** Visible at the **top** of the table (below header)
- **Sorting:** Enabled
- **Expand/collapse subtasks:** Enabled

### Completed Tab

- Displays tasks with `status === Completed`
- **Complete button:** Shown as filled/checked (visual indicator only, non-interactive)
- **Edit button:** Visible on hover -- enables full edit mode on any tab
- **Restore button:** Always visible -- moves task back to Active, clears `completedAt`
- **Inline creation row:** Not shown
- **Sorting:** Enabled
- **Expand/collapse subtasks:** Enabled

### Deleted Tab

- Displays tasks with `status === Deleted`
- **Permanent delete button:** Visible in first column (X icon) -- removes from data entirely
- **Edit button:** Visible on hover -- enables full edit mode
- **Restore button:** Always visible -- moves task back to Active
- **Inline creation row:** Not shown
- **Sorting:** Enabled
- **Expand/collapse subtasks:** Enabled

## Empty States

When a tab has no tasks:
- **Active:** "No tasks yet. Add one above!" with clipboard icon
- **Completed:** "No completed tasks yet" with checkmark icon
- **Deleted:** "Trash is empty" with trash icon

## Tab Transitions

When a task changes status (completed, deleted, restored):
1. Task row fades out from the current tab (~200ms animation)
2. The row is removed from the current list
3. The destination tab's count badge updates immediately
4. The task appears in the destination tab's list when that tab is viewed

## Cross-references

- Task status changes: [02-task-management.md](02-task-management.md)
- Table component reuse: [03-task-table.md](03-task-table.md)
- Route definitions: [00-overview.md](00-overview.md)
