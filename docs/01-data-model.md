# Data Model

## Task Interface

```typescript
interface Task {
  id: string;                  // UUID (generated client-side, stored in DB)
  title: string;               // Required, min 1 character
  description: string;         // Optional, default ""
  priority: Priority;          // Default: Priority.None
  dueDate: Date | null;        // Default: null
  assignee: string;            // Optional, default ""
  status: TaskStatus;          // Default: TaskStatus.Active
  parentId: string | null;     // null = top-level task
  subtaskIds: string[];        // Ordered list of child task IDs
  createdAt: Date;
  completedAt: Date | null;
  isExpanded: boolean;         // UI state for subtask collapse, default false
  sortOrder: number;           // Determines display order; lower = first
}
```

## Priority Enum

```typescript
enum Priority {
  None = 'none',
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Urgent = 'urgent'
}
```

| Priority | Sort Weight |
|----------|-------------|
| None     | 0           |
| Low      | 1           |
| Medium   | 2           |
| High     | 3           |
| Urgent   | 4           |

## TaskStatus Enum

```typescript
enum TaskStatus {
  Active = 'active',
  Completed = 'completed',
  Deleted = 'deleted'
}
```

## TaskService Contract

### State (Signals)

- `tasksMap: signal<Map<string, Task>>` -- flat map of all tasks by ID (private, loaded from Supabase on login)
- `loading: signal<boolean>` -- true while fetching from Supabase
- `assigneePool: signal<string[]>` -- list of known assignee names
- `creatingTaskParentId: signal<string | null | undefined>` -- UI state driving inline creation row visibility
- **Computed signals:**
  - `activeTasks` -- top-level tasks where `status === Active`, ordered by `sortOrder`
  - `completedTasks` -- top-level tasks where `status === Completed`
  - `deletedTasks` -- top-level tasks where `status === Deleted`
  - `completedTasksView` -- completed tasks + active/deleted placeholder parents with completed subtasks
  - `deletedTasksView` -- deleted tasks + active/completed placeholder parents with deleted subtasks
  - `deletedPlaceholderParentIds` -- Set of parent IDs whose subtasks are deleted but parent is not
  - `completedPlaceholderParentIds` -- Set of parent IDs whose subtasks are completed but parent is not

### Methods (all async — optimistic update + Supabase sync)

| Method | Returns | Description |
|--------|---------|-------------|
| `createTask(partial)` | `Promise<Task \| null>` | Create a new task with defaults |
| `updateTask(id, changes)` | `Promise<void>` | Update specific fields |
| `completeTask(id)` | `Promise<boolean>` | Set status to Completed; returns false if blocked by incomplete subtasks |
| `deleteTask(id)` | `Promise<void>` | Soft-delete (cascades to subtasks) |
| `restoreTask(id)` | `Promise<boolean>` | Set status back to Active; returns false if parent is still deleted/completed |
| `permanentlyDeleteTask(id)` | `Promise<void>` | Hard-delete from DB (Deleted tab only) |
| `addSubtask(parentId, partial)` | `Promise<Task \| null>` | Create a subtask and update parent's `subtaskIds` |
| `reorderTasks(taskIds)` | `Promise<void>` | Assign ascending `sortOrder` values matching the given ID order |
| `reorderSubtasks(parentId, subtaskIds)` | `Promise<void>` | Update parent's `subtaskIds` and child `sortOrder` values |
| `addAssignee(name)` | `Promise<void>` | Add name to assignee pool in DB |
| `startCreatingTask(parentId)` | `void` | Set creation row state (null = top-level, string = subtask parent) |
| `stopCreating()` | `void` | Hide the creation row |

### Validation Rules

1. **Title is required** -- task is not created until title has a non-empty value
2. **Cannot complete a parent task** if any subtask has `status !== Completed`
3. **Deleting a parent** also soft-deletes all subtasks
4. **Subtasks are one level deep only** -- a subtask cannot have its own subtasks
5. **Cannot restore a subtask** if its parent is still deleted or completed

## Assignee Pool

- Maintained as `assigneePool: signal<string[]>`
- Stored in the `assignees` table in Supabase (one row per user per name)
- When a user types a new name into the assignee field, it is added to the pool
- The assignee field renders as a searchable `<datalist>` of existing pool names

## DB Schema (Supabase)

### `tasks` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key, client-generated |
| `user_id` | `uuid` | Set automatically by DB trigger (`auth.uid()`) |
| `title` | `text` | Not null |
| `description` | `text` | Default `''` |
| `priority` | `text` | Check: `none/low/medium/high/urgent` |
| `due_date` | `timestamptz` | Nullable |
| `assignee` | `text` | Default `''` |
| `status` | `text` | Check: `active/completed/deleted` |
| `parent_id` | `uuid` | FK → `tasks.id` ON DELETE CASCADE |
| `subtask_ids` | `text[]` | Ordered list of child IDs |
| `created_at` | `timestamptz` | Default `now()` |
| `completed_at` | `timestamptz` | Nullable |
| `is_expanded` | `boolean` | Default `false` |
| `sort_order` | `bigint` | Default `0`; lower = displayed first |

Row Level Security enabled — users can only access their own rows.

### `assignees` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | Set automatically by DB trigger |
| `name` | `text` | Unique per user |

## camelCase ↔ snake_case Mapping (`src/app/models/mapper.ts`)

All conversion between the Angular `Task` model (camelCase) and DB rows (snake_case) is handled in `mapper.ts`:

- `rowToTask(row: TaskRow): Task` — DB → app model (parses ISO strings to Dates)
- `taskToInsert(task: Task): TaskInsert` — app model → DB insert payload
- `taskToUpdate(partial: Partial<Task>): TaskUpdate` — partial app model → partial DB update

## Persistence

- All task and assignee data lives in Supabase (PostgreSQL)
- Theme preference (`dark/light`) is still stored in `localStorage` via `ThemeService`
- On login: `TaskService` fetches all tasks and assignees from Supabase
- On logout: `TaskService` clears the in-memory signal maps
- All mutations use **optimistic updates** (signal updated first, then Supabase call; rollback on error via `loadTasks()`)

## Cross-references

- Auth & session lifecycle: [10-auth.md](10-auth.md)
- Task rendering: [03-task-table.md](03-task-table.md)
- Subtask behavior: [04-subtasks.md](04-subtasks.md)
- Tab filtering: [06-tabs.md](06-tabs.md)
