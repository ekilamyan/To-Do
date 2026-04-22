export enum Priority {
  None = 'none',
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Urgent = 'urgent'
}

export enum TaskStatus {
  Active = 'active',
  Completed = 'completed',
  Deleted = 'deleted'
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  dueDate: Date | null;
  assignee: string;
  status: TaskStatus;
  parentId: string | null;
  subtaskIds: string[];
  createdAt: Date;
  completedAt: Date | null;
  isExpanded: boolean;
  sortOrder: number;
  asanaGid: string | null;
}

export const PRIORITY_WEIGHTS: Record<Priority, number> = {
  [Priority.None]: 0,
  [Priority.Low]: 1,
  [Priority.Medium]: 2,
  [Priority.High]: 3,
  [Priority.Urgent]: 4,
};

export type TabType = 'active' | 'completed' | 'deleted';

export interface SortState {
  column: string | null;
  direction: 'asc' | 'desc' | null;
}
