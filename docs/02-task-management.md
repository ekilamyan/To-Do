# Task Management (CRUD)

## Create

- A **"+ Task" button** in the app header (visible only on the active tab) triggers task creation
- Clicking it renders an **inline creation row** at the **bottom** of the active task table
- All fields (Title, Description, Priority, Due Date, Assignee) are **always visible** as input fields with borders
- A **Save button** in the action column explicitly commits the task
- Only the **Title is required** -- all other fields have defaults
- The task is persisted when the user clicks Save or presses Enter (title must be non-empty)
- Pressing Escape or clicking away with an empty title discards the row
- Default values on creation:
  - `description: ""`
  - `priority: Priority.None`
  - `dueDate: null`
  - `assignee: ""`
  - `status: TaskStatus.Active`
  - `parentId: null`
  - `subtaskIds: []`
  - `createdAt: new Date()`
  - `sortOrder: Date.now()`
- After creation, the creation row disappears (click "+ Task" again for another)

## Read

- Tasks are displayed in the `TaskTableComponent` as table rows
- Filtered by the current tab (active, completed, deleted)
- Table columns: Complete button | Expand chevron | Title | Description | Priority | Due Date | Assignee | Actions (edit + delete/restore)

## Update / Edit Mode

Tasks can be edited via an **edit mode** toggle:

1. Each task row has an **edit button** (pencil icon) in the actions column, visible on hover
2. Clicking the edit button enters **edit mode** for that row:
   - Row highlights with accent left border and different background
   - All fields transform into full input fields (matching the creation row style)
   - Fields have visible borders, proper padding, and focus glow
3. Click the edit button again (shows checkmark when in edit mode) to exit
4. **Edit mode works on ALL tabs** -- active, completed, and deleted

### Field Edit Controls

| Field       | Edit Control          | Commit Trigger      |
|-------------|-----------------------|---------------------|
| Title       | Text input            | Blur or Enter       |
| Description | Text input            | Blur or Enter       |
| Priority    | Dropdown select       | Selection change    |
| Due Date    | Styled date picker    | Date selection      |
| Assignee    | Searchable dropdown   | Selection or new entry |

- Changes are applied **immediately** -- no save button
- Escape cancels the current edit and reverts to the previous value

## Complete

1. User clicks the complete button (circle checkbox) on a task row
2. **Subtask check:** If the task has subtasks and any are not completed, the action is **blocked** with a **snackbar notification** at the bottom of the screen: _"Complete all subtasks before completing the parent task"_
3. If allowed: task `status` is set to `Completed`, `completedAt` is set to `new Date()`
4. Task disappears from the active list (with fade-out animation)
5. Task appears in the Completed tab
6. Completed tab count badge updates

## Delete

1. User clicks the delete button (trash icon) on a task row
2. Task `status` is set to `Deleted`
3. **If task has subtasks:** all subtasks are also set to `Deleted`
4. Task disappears from current list (with fade-out animation)
5. Task appears in the Deleted tab

## Permanent Delete

- Available only on the Deleted tab
- Removes task from data entirely (irreversible)
- If task has subtasks, all subtasks are also permanently removed
- Button is in the complete button column position (X icon)

## Restore

- Available on both Completed and Deleted tabs (always-visible restore button)
- Sets task `status` back to `Active`
- Clears `completedAt` if restoring from Completed
- If parent task, also restores all subtasks
- Task reappears in Active tab

## Edge Cases

- **Title is required (min 1 character):** If editing an existing task's title, clearing it completely reverts to the previous value
- **Empty title on blur (creation row):** If the user leaves the creation row without entering a title, the draft is discarded silently
- **Rapid creation:** UUID generation via `crypto.randomUUID()` ensures unique IDs
- **Long text:** Title and description cells truncate with ellipsis; full text visible when editing
- **Completing with mixed subtasks:** Only the parent is blocked; individual subtasks can always be completed independently

## Cross-references

- Inline creation UX: [03-task-table.md](03-task-table.md)
- Subtask completion rules: [04-subtasks.md](04-subtasks.md)
- Tab transitions: [06-tabs.md](06-tabs.md)
