import { Task, Priority, TaskStatus } from './task.model';

export interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  priority: string;
  due_date: string | null;
  assignee: string;
  status: string;
  parent_id: string | null;
  subtask_ids: string[];
  created_at: string;
  completed_at: string | null;
  is_expanded: boolean;
  sort_order: number;
}

export type TaskInsert = Omit<TaskRow, 'id' | 'user_id' | 'created_at'>;
export type TaskUpdate = Partial<Omit<TaskRow, 'id' | 'user_id' | 'created_at'>>;

export function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    priority: (row.priority as Priority) ?? Priority.None,
    dueDate: row.due_date ? new Date(row.due_date) : null,
    assignee: row.assignee ?? '',
    status: (row.status as TaskStatus) ?? TaskStatus.Active,
    parentId: row.parent_id ?? null,
    subtaskIds: row.subtask_ids ?? [],
    createdAt: new Date(row.created_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    isExpanded: row.is_expanded ?? false,
    sortOrder: row.sort_order ?? 0,
  };
}

export function taskToInsert(task: Task): TaskInsert {
  return {
    title: task.title,
    description: task.description || '',
    priority: task.priority,
    due_date: task.dueDate ? task.dueDate.toISOString() : null,
    assignee: task.assignee || '',
    status: task.status,
    parent_id: task.parentId ?? null,
    subtask_ids: task.subtaskIds ?? [],
    completed_at: task.completedAt ? task.completedAt.toISOString() : null,
    is_expanded: task.isExpanded,
    sort_order: task.sortOrder,
  };
}

export function taskToUpdate(partial: Partial<Task>): TaskUpdate {
  const update: TaskUpdate = {};
  if ('title' in partial)       update.title        = partial.title!;
  if ('description' in partial) update.description  = partial.description || '';
  if ('priority' in partial)    update.priority     = partial.priority!;
  if ('dueDate' in partial)     update.due_date     = partial.dueDate ? partial.dueDate.toISOString() : null;
  if ('assignee' in partial)    update.assignee     = partial.assignee || '';
  if ('status' in partial)      update.status       = partial.status!;
  if ('parentId' in partial)    update.parent_id    = partial.parentId ?? null;
  if ('subtaskIds' in partial)  update.subtask_ids  = partial.subtaskIds ?? [];
  if ('completedAt' in partial) update.completed_at = partial.completedAt ? partial.completedAt.toISOString() : null;
  if ('isExpanded' in partial)  update.is_expanded  = partial.isExpanded!;
  if ('sortOrder' in partial)   update.sort_order   = partial.sortOrder!;
  return update;
}
