import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { Task, TaskStatus, Priority } from '../models/task.model';
import { SUPABASE_CLIENT } from '../core/supabase.client';
import { AuthService } from './auth.service';
import { rowToTask, taskToInsert, taskToUpdate, TaskRow } from '../models/mapper';
import { AsanaService } from './asana.service';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private supabase     = inject<SupabaseClient>(SUPABASE_CLIENT);
  private authService  = inject(AuthService);
  private asana        = inject(AsanaService);

  private tasksMap         = signal<Map<string, Task>>(new Map());
  private realtimeChannel: RealtimeChannel | null = null;
  assigneePool             = signal<string[]>([]);
  loading                  = signal<boolean>(false);

  /** undefined = not creating, null = creating top-level task, string = creating subtask under that parent */
  creatingTaskParentId = signal<string | null | undefined>(undefined);

  activeTasks = computed(() => this.getTopLevelTasksByStatus(TaskStatus.Active));
  completedTasks = computed(() => this.getTopLevelTasksByStatus(TaskStatus.Completed));
  deletedTasks   = computed(() => this.getTopLevelTasksByStatus(TaskStatus.Deleted));

  deletedPlaceholderParentIds  = computed(() => this.getPlaceholderParentIds(TaskStatus.Deleted));
  completedPlaceholderParentIds = computed(() => this.getPlaceholderParentIds(TaskStatus.Completed));

  deletedTasksView = computed(() =>
    this.getTasksViewWithPlaceholders(this.deletedTasks(), this.deletedPlaceholderParentIds())
  );
  completedTasksView = computed(() =>
    this.getTasksViewWithPlaceholders(this.completedTasks(), this.completedPlaceholderParentIds())
  );

  constructor() {
    effect(() => {
      if (this.authService.isLoggedIn()) {
        this.loadTasks();
        this.loadAssignees();
        this.setupRealtime();
      } else {
        this.tasksMap.set(new Map());
        this.assigneePool.set([]);
        this.teardownRealtime();
      }
    });
  }

  private setupRealtime(): void {
    this.teardownRealtime();
    this.realtimeChannel = this.supabase
      .channel('tasks-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => this.handleRealtimeChange(payload),
      )
      .subscribe();
  }

  private teardownRealtime(): void {
    if (this.realtimeChannel) {
      this.supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }

  private handleRealtimeChange(payload: { eventType: string; new: unknown; old: unknown }): void {
    const { eventType, new: newRow, old: oldRow } = payload;
    this.tasksMap.update(map => {
      const next = new Map(map);
      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        const task = rowToTask(newRow as TaskRow);
        next.set(task.id, task);
      } else if (eventType === 'DELETE') {
        const id = (oldRow as { id: string }).id;
        next.delete(id);
      }
      return next;
    });
  }

  // ─── Loading ─────────────────────────────────────────────────────────────

  private async loadTasks(): Promise<void> {
    this.loading.set(true);
    const { data, error } = await this.supabase
      .from('tasks')
      .select('*')
      .order('sort_order', { ascending: true });

    if (!error && data) {
      const map = new Map<string, Task>();
      for (const row of data as TaskRow[]) {
        map.set(row.id, rowToTask(row));
      }
      this.tasksMap.set(map);
    }
    this.loading.set(false);
  }

  private async loadAssignees(): Promise<void> {
    const { data, error } = await this.supabase
      .from('assignees')
      .select('name')
      .order('name', { ascending: true });

    if (!error && data) {
      this.assigneePool.set(data.map((r: { name: string }) => r.name));
    }
  }

  private async reloadFromDb(): Promise<void> {
    await this.loadTasks();
    await this.loadAssignees();
  }

  // ─── Derived helpers ─────────────────────────────────────────────────────

  private getTopLevelTasksByStatus(status: TaskStatus): Task[] {
    const map = this.tasksMap();
    const tasks: Task[] = [];
    for (const task of map.values()) {
      if (task.parentId === null && task.status === status) {
        tasks.push(task);
      }
    }
    return tasks.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  private getPlaceholderParentIds(status: TaskStatus): Set<string> {
    const map = this.tasksMap();
    const ids = new Set<string>();
    for (const task of map.values()) {
      if (task.parentId && task.status === status) {
        const parent = map.get(task.parentId);
        if (parent && parent.status !== status) {
          ids.add(task.parentId);
        }
      }
    }
    return ids;
  }

  private getTasksViewWithPlaceholders(tasks: Task[], placeholderIds: Set<string>): Task[] {
    if (placeholderIds.size === 0) return tasks;
    const map = this.tasksMap();
    const result = [...tasks];
    for (const parentId of placeholderIds) {
      const parent = map.get(parentId);
      if (parent) result.push(parent);
    }
    return result.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  getSubtasks(parentId: string): Task[] {
    const map = this.tasksMap();
    const parent = map.get(parentId);
    if (!parent) return [];
    return parent.subtaskIds
      .map(id => map.get(id))
      .filter((t): t is Task => t !== undefined);
  }

  getSubtasksByStatus(parentId: string, status: TaskStatus): Task[] {
    const map = this.tasksMap();
    const result: Task[] = [];
    for (const task of map.values()) {
      if (task.parentId === parentId && task.status === status) {
        result.push(task);
      }
    }
    return result.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  // ─── Mutations ───────────────────────────────────────────────────────────

  async createTask(partial: Partial<Task>): Promise<Task | null> {
    const task: Task = {
      id: crypto.randomUUID(),
      title: partial.title ?? '',
      description: partial.description ?? '',
      priority: partial.priority ?? Priority.None,
      dueDate: partial.dueDate ?? null,
      assignee: partial.assignee ?? '',
      status: TaskStatus.Active,
      parentId: partial.parentId ?? null,
      subtaskIds: [],
      createdAt: new Date(),
      completedAt: null,
      isExpanded: false,
      sortOrder: Date.now(),
      asanaGid: null,
    };

    // Optimistic update
    this.tasksMap.update(map => {
      const next = new Map(map);
      next.set(task.id, task);
      return next;
    });

    if (task.assignee) {
      this.addAssignee(task.assignee);
    }

    const { data, error } = await this.supabase
      .from('tasks')
      .insert({ id: task.id, ...taskToInsert(task) })
      .select()
      .single();

    if (error) {
      await this.reloadFromDb();
      return null;
    }

    // Use DB-returned row (has server-set fields)
    const saved = rowToTask(data as TaskRow);
    this.tasksMap.update(map => {
      const next = new Map(map);
      next.set(saved.id, saved);
      return next;
    });

    // Async: create in Asana and write back the asana_gid
    this.asana.syncCreateTask(saved, (asanaGid) => {
      this.supabase.from('tasks').update({ asana_gid: asanaGid }).eq('id', saved.id).then(() => {
        this.tasksMap.update(map => {
          const next = new Map(map);
          const t = next.get(saved.id);
          if (t) next.set(saved.id, { ...t, asanaGid });
          return next;
        });
      });
    });

    return saved;
  }

  async updateTask(id: string, changes: Partial<Task>): Promise<void> {
    if (changes.assignee) {
      this.addAssignee(changes.assignee);
    }

    // Optimistic update
    this.tasksMap.update(map => {
      const existing = map.get(id);
      if (!existing) return map;
      const next = new Map(map);
      next.set(id, { ...existing, ...changes });
      return next;
    });

    const { error } = await this.supabase
      .from('tasks')
      .update(taskToUpdate(changes))
      .eq('id', id);

    if (error) {
      await this.reloadFromDb();
      return;
    }

    // Sync field changes to Asana (non-blocking)
    const task = this.tasksMap().get(id);
    if (task?.asanaGid) {
      this.asana.syncUpdateTask(task.asanaGid, changes);
    }
  }

  async completeTask(id: string): Promise<boolean> {
    const map = this.tasksMap();
    const task = map.get(id);
    if (!task) return false;

    for (const subId of task.subtaskIds) {
      const sub = map.get(subId);
      if (sub && sub.status !== TaskStatus.Completed) return false;
    }

    const asanaGid = map.get(id)?.asanaGid ?? null;
    await this.updateTask(id, { status: TaskStatus.Completed, completedAt: new Date() });
    if (asanaGid) this.asana.syncCompleteTask(asanaGid);
    return true;
  }

  async deleteTask(id: string): Promise<void> {
    const map = this.tasksMap();
    const task = map.get(id);
    if (!task) return;
    const asanaGid = task.asanaGid;

    // Build all IDs to soft-delete
    const idsToDelete = [id, ...task.subtaskIds];

    // Optimistic update
    this.tasksMap.update(m => {
      const next = new Map(m);
      for (const tid of idsToDelete) {
        const t = next.get(tid);
        if (t) next.set(tid, { ...t, status: TaskStatus.Deleted });
      }
      // If subtask, remove from parent's subtaskIds
      if (task.parentId) {
        const parent = next.get(task.parentId);
        if (parent) {
          next.set(task.parentId, {
            ...parent,
            subtaskIds: parent.subtaskIds.filter(sid => sid !== id),
          });
        }
      }
      return next;
    });

    const { error } = await this.supabase
      .from('tasks')
      .update({ status: 'deleted' })
      .in('id', idsToDelete);

    if (!error && task.parentId) {
      // Sync parent's subtask_ids in DB
      const parent = this.tasksMap().get(task.parentId);
      if (parent) {
        await this.supabase
          .from('tasks')
          .update({ subtask_ids: parent.subtaskIds })
          .eq('id', task.parentId);
      }
    }

    if (error) { await this.reloadFromDb(); return; }
    if (asanaGid) this.asana.syncDeleteTask(asanaGid);
  }

  async restoreTask(id: string): Promise<boolean> {
    const map = this.tasksMap();
    const task = map.get(id);
    if (!task) return false;
    const asanaGid = task.asanaGid;

    if (task.parentId) {
      const parent = map.get(task.parentId);
      if (parent && parent.status !== TaskStatus.Active) return false;
    }

    const idsToRestore = [id, ...task.subtaskIds];

    // Optimistic update
    this.tasksMap.update(m => {
      const next = new Map(m);
      for (const tid of idsToRestore) {
        const t = next.get(tid);
        if (t) next.set(tid, { ...t, status: TaskStatus.Active, completedAt: null });
      }
      if (task.parentId) {
        const parent = next.get(task.parentId);
        if (parent && parent.status === TaskStatus.Active && !parent.subtaskIds.includes(id)) {
          next.set(task.parentId, {
            ...parent,
            subtaskIds: [...parent.subtaskIds, id],
          });
        }
      }
      return next;
    });

    const { error } = await this.supabase
      .from('tasks')
      .update({ status: 'active', completed_at: null })
      .in('id', idsToRestore);

    if (!error && task.parentId) {
      const parent = this.tasksMap().get(task.parentId);
      if (parent) {
        await this.supabase
          .from('tasks')
          .update({ subtask_ids: parent.subtaskIds })
          .eq('id', task.parentId);
      }
    }

    if (error) { await this.reloadFromDb(); return false; }
    if (asanaGid) this.asana.syncRestoreTask(asanaGid);
    return true;
  }

  async permanentlyDeleteTask(id: string): Promise<void> {
    const map = this.tasksMap();
    const task = map.get(id);
    if (!task) return;

    const idsToDelete = [id, ...task.subtaskIds];

    // Optimistic update
    this.tasksMap.update(m => {
      const next = new Map(m);
      for (const tid of idsToDelete) next.delete(tid);
      if (task.parentId) {
        const parent = next.get(task.parentId);
        if (parent) {
          next.set(task.parentId, {
            ...parent,
            subtaskIds: parent.subtaskIds.filter(sid => sid !== id),
          });
        }
      }
      return next;
    });

    const { error } = await this.supabase
      .from('tasks')
      .delete()
      .in('id', idsToDelete);

    if (error) await this.reloadFromDb();
  }

  async addSubtask(parentId: string, partial: Partial<Task>): Promise<Task | null> {
    const task: Task = {
      id: crypto.randomUUID(),
      title: partial.title ?? '',
      description: partial.description ?? '',
      priority: partial.priority ?? Priority.None,
      dueDate: partial.dueDate ?? null,
      assignee: partial.assignee ?? '',
      status: TaskStatus.Active,
      parentId,
      subtaskIds: [],
      createdAt: new Date(),
      completedAt: null,
      isExpanded: false,
      sortOrder: Date.now(),
      asanaGid: null,
    };

    // Optimistic: add task AND update parent subtaskIds in one synchronous update
    this.tasksMap.update(map => {
      const next = new Map(map);
      next.set(task.id, task);
      const parent = next.get(parentId);
      if (parent) {
        next.set(parentId, { ...parent, subtaskIds: [...parent.subtaskIds, task.id] });
      }
      return next;
    });

    if (task.assignee) this.addAssignee(task.assignee);

    const updatedParent = this.tasksMap().get(parentId);

    const [subtaskResult] = await Promise.all([
      this.supabase.from('tasks').insert({ id: task.id, ...taskToInsert(task) }).select().single(),
      updatedParent
        ? this.supabase.from('tasks').update({ subtask_ids: updatedParent.subtaskIds }).eq('id', parentId)
        : Promise.resolve({ error: null })
    ]);

    if (subtaskResult.error) {
      await this.reloadFromDb();
      return null;
    }

    const savedSubtask = rowToTask(subtaskResult.data as TaskRow);

    // Sync subtask to Asana under parent's asana_gid (non-blocking)
    const parentAsanaGid = this.tasksMap().get(parentId)?.asanaGid ?? null;
    if (parentAsanaGid) {
      this.asana.syncCreateSubtask(savedSubtask, parentAsanaGid, (asanaGid) => {
        this.supabase.from('tasks').update({ asana_gid: asanaGid }).eq('id', savedSubtask.id).then(() => {
          this.tasksMap.update(map => {
            const next = new Map(map);
            const t = next.get(savedSubtask.id);
            if (t) next.set(savedSubtask.id, { ...t, asanaGid });
            return next;
          });
        });
      });
    } else if (this.asana.isConnected()) {
      // Parent has no asana_gid yet — create as a top-level task instead
      this.asana.syncCreateTask(savedSubtask, (asanaGid) => {
        this.supabase.from('tasks').update({ asana_gid: asanaGid }).eq('id', savedSubtask.id).then(() => {
          this.tasksMap.update(map => {
            const next = new Map(map);
            const t = next.get(savedSubtask.id);
            if (t) next.set(savedSubtask.id, { ...t, asanaGid });
            return next;
          });
        });
      });
    }

    return savedSubtask;
  }

  startCreatingTask(parentId: string | null): void {
    this.creatingTaskParentId.set(parentId);
    if (parentId !== null) {
      const map = this.tasksMap();
      const parent = map.get(parentId);
      if (parent && !parent.isExpanded) {
        this.updateTask(parentId, { isExpanded: true });
      }
    }
  }

  stopCreating(): void {
    this.creatingTaskParentId.set(undefined);
  }

  async reorderTasks(taskIds: string[]): Promise<void> {
    // Optimistic update — sortOrder = i + 1 so first item gets lowest value and sorts first (ascending)
    this.tasksMap.update(map => {
      const next = new Map(map);
      for (let i = 0; i < taskIds.length; i++) {
        const task = next.get(taskIds[i]);
        if (task) next.set(taskIds[i], { ...task, sortOrder: i + 1 });
      }
      return next;
    });

    const updates = taskIds.map((id, i) =>
      this.supabase.from('tasks').update({ sort_order: i + 1 }).eq('id', id)
    );
    await Promise.all(updates);
  }

  async reorderSubtasks(parentId: string, subtaskIds: string[]): Promise<void> {
    this.tasksMap.update(map => {
      const parent = map.get(parentId);
      if (!parent) return map;
      const next = new Map(map);
      next.set(parentId, { ...parent, subtaskIds });
      for (let i = 0; i < subtaskIds.length; i++) {
        const sub = next.get(subtaskIds[i]);
        if (sub) next.set(subtaskIds[i], { ...sub, sortOrder: i + 1 });
      }
      return next;
    });

    const updates = [
      this.supabase.from('tasks').update({ subtask_ids: subtaskIds }).eq('id', parentId),
      ...subtaskIds.map((id, i) =>
        this.supabase.from('tasks').update({ sort_order: i + 1 }).eq('id', id)
      )
    ];
    await Promise.all(updates);
  }

  async addAssignee(name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) return;

    // Optimistic update
    this.assigneePool.update(pool => {
      if (pool.includes(trimmed)) return pool;
      return [...pool, trimmed];
    });

    await this.supabase
      .from('assignees')
      .insert({ name: trimmed })
      .select();
    // Ignore duplicate errors (unique constraint) — optimistic update already handled it
  }
}
