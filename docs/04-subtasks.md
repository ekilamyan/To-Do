# Subtasks

## Data Relationship

- A subtask is a `Task` with a non-null `parentId`
- The parent task's `subtaskIds[]` array maintains the display order of its children
- **Subtasks are one level deep only** -- a subtask cannot have its own subtasks
- Subtasks have the same fields as regular tasks (Title, Description, Priority, Due Date, Assignee)

## Adding a Subtask

- Each parent task row on the active tab has a **"+" button** in the action column
- Clicking it expands the parent (if collapsed) and shows an **inline creation row** as the last item under its subtasks
- The creation row has a **Save button** and follows the same pattern as main task creation (see [03-task-table.md](03-task-table.md))
- Only Title is required to create a subtask
- New subtask is added to the end of the parent's `subtaskIds[]` array
- After saving, the creation row disappears

## Subtask Count Indicator

- Parent tasks with subtasks display a count indicator next to the expand chevron
- Format: small badge showing the count (e.g., `3`) or text like `3 subtasks`
- The indicator shows total subtask count and completed count: e.g., `2/5` (2 of 5 completed)
- Visible whether the parent is expanded or collapsed

## Expand / Collapse

- An **expand chevron** (`>` / `v`) appears in column 2 for all top-level tasks on the active tab, or for tasks with `subtaskIds.length > 0` on other tabs
- Clicking the chevron toggles `task.isExpanded`
  - **Collapsed (default):** subtask rows are not rendered (`@if` / conditional rendering)
  - **Expanded:** subtask rows appear directly below the parent, visually indented
- Expand/collapse state is stored on the `Task.isExpanded` property
- Animation: subtasks slide down on expand, slide up on collapse (~150ms)

## Subtask Reordering

- Subtasks can be **dragged to reorder** within their parent (same-level only, no cross-parent moves)
- Uses Angular CDK drag-drop, same as top-level task reordering
- Drag disabled when a column sort is active
- Order persisted via `subtaskIds[]` array on the parent and `sortOrder` on each subtask

## Subtask Row Display

- Subtask rows are visually indented with **28px left padding** on the title cell
- No expand chevron on subtask rows (since nesting is one level only)
- All other columns (Description, Priority, Due Date, Assignee) align with parent task columns
- Subtask rows are inline-editable, same as parent task rows
- Complete and Delete buttons function the same as regular tasks

## Completion Rules

| Scenario | Behavior |
|----------|----------|
| Complete an individual subtask | Allowed -- subtask disappears from active tab |
| Complete a parent with ALL subtasks completed | Allowed -- parent + all subtasks move to Completed tab |
| Complete a parent with ANY subtask NOT completed | **Blocked** -- snackbar notification shown |

- Snackbar message: _"Complete all subtasks before completing the parent task"_
- Displayed at bottom-center of the screen, auto-dismisses after 3 seconds
- **Do NOT auto-complete subtasks** when completing a parent -- each subtask must be completed individually

## Deletion Rules

| Scenario | Behavior |
|----------|----------|
| Delete a parent task | Parent AND all subtasks are set to `Deleted` |
| Delete an individual subtask | Only that subtask is deleted; removed from parent's `subtaskIds[]` |
| Restore a deleted parent | Parent AND all subtasks are restored to `Active` |
| Restore a deleted subtask | Only that subtask is restored; re-added to parent's `subtaskIds[]` if parent is active |

## Cross-references

- Task data model: [01-data-model.md](01-data-model.md)
- Table display: [03-task-table.md](03-task-table.md)
- Completion logic: [02-task-management.md](02-task-management.md)
