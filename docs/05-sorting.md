# Sorting

## Sortable Columns

| Column      | Sort Type     | Details                                           |
|-------------|---------------|---------------------------------------------------|
| Title       | Alphabetical  | A-Z ascending, Z-A descending                     |
| Description | Alphabetical  | A-Z ascending, Z-A descending                     |
| Priority    | By weight     | Urgent > High > Medium > Low > None               |
| Due Date    | Chronological | Earliest first (asc), latest first (desc); nulls last |
| Assignee    | Alphabetical  | A-Z ascending, Z-A descending; empty values last  |

## Non-Sortable Columns

- Complete button
- Expand/collapse chevron
- Delete button

## Sort Behavior

### Click Cycle
1. **First click:** Sort ascending
2. **Second click:** Sort descending
3. **Third click:** Remove sort (return to creation order)

### Rules
- **Single-column sort only** -- clicking a new column resets the previous sort
- Visual indicator: arrow icon in the column header
  - Ascending: up arrow
  - Descending: down arrow
  - Unsorted: no arrow (or neutral indicator)
- Default state: unsorted (tasks in creation order)

## Sort and Subtasks

- Sorting applies **only to top-level tasks**
- Subtasks maintain their order within the parent (by `subtaskIds[]` array order)
- When a parent task is expanded and the table is sorted, subtasks remain grouped directly under their parent -- they do not get separated

## Implementation Notes

### Sort State

```typescript
interface SortState {
  column: string | null;       // Column key or null if unsorted
  direction: 'asc' | 'desc' | null;
}
```

### Approach
- `SortState` is a signal within the `TaskTableComponent`
- A computed signal derives the sorted task list from the input tasks + sort state
- Sort comparator functions per column type:
  - **String columns** (title, description, assignee): `localeCompare()`
  - **Date columns** (dueDate): numeric comparison, nulls pushed to end
  - **Enum columns** (priority): compare by weight value (see [01-data-model.md](01-data-model.md))

## Cross-references

- Table component: [03-task-table.md](03-task-table.md)
- Priority sort weights: [01-data-model.md](01-data-model.md)
