import { Injectable, inject, computed, signal } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../core/supabase.client';
import { SubscriptionService } from './subscription.service';
import { Task } from '../models/task.model';

export interface AsanaProject {
  gid: string;
  name: string;
  workspace: string;
}

@Injectable({ providedIn: 'root' })
export class AsanaService {
  private supabase = inject<SupabaseClient>(SUPABASE_CLIENT);
  private subscriptionService = inject(SubscriptionService);

  readonly isConnected = computed(() => this.subscriptionService.asanaSyncEnabled());
  readonly isSyncing = signal(false);

  // ─── Connection management ───────────────────────────────────────────────

  private async extractError(error: unknown): Promise<string> {
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx?.json) {
        const body = await ctx.json();
        return body?.error ?? (error as Error).message ?? 'Unknown error';
      }
    } catch { /* ignore */ }
    return (error as Error).message ?? 'Unknown error';
  }

  async fetchProjects(pat: string): Promise<AsanaProject[]> {
    const { data, error } = await this.supabase.functions.invoke('asana-get-projects', {
      body: { pat },
    });
    if (error) throw new Error(await this.extractError(error));
    if (data?.error) throw new Error(data.error);
    return data.projects as AsanaProject[];
  }

  async connect(pat: string, projectGid: string): Promise<void> {
    const { data, error } = await this.supabase.functions.invoke('asana-connect', {
      body: { pat, project_gid: projectGid },
    });
    if (error) throw new Error(await this.extractError(error));
    if (data?.error) throw new Error(data.error);
    await this.subscriptionService.loadProfile();
  }

  async disconnect(): Promise<void> {
    const { data, error } = await this.supabase.functions.invoke('asana-disconnect', { body: {} });
    if (error) throw new Error(await this.extractError(error));
    if (data?.error) throw new Error(data.error);
    await this.subscriptionService.loadProfile();
  }

  // ─── Task sync (App → Asana) ─────────────────────────────────────────────
  // All sync methods are fire-and-forget — they don't block the UI.

  syncCreateTask(task: Task, onGid: (gid: string) => void): void {
    if (!this.isConnected()) return;
    this.supabase.functions
      .invoke('asana-proxy', {
        body: {
          action:      'createTask',
          title:       task.title,
          description: task.description,
          priority:    task.priority,
          dueDate:     task.dueDate?.toISOString() ?? null,
        },
      })
      .then(({ data, error }) => {
        if (!error && data?.asana_gid) onGid(data.asana_gid);
      })
      .catch(() => { /* non-blocking */ });
  }

  syncCreateSubtask(task: Task, parentAsanaGid: string, onGid: (gid: string) => void): void {
    if (!this.isConnected()) return;
    this.supabase.functions
      .invoke('asana-proxy', {
        body: {
          action:         'createSubtask',
          parentAsanaGid,
          title:          task.title,
          description:    task.description,
          priority:       task.priority,
          dueDate:        task.dueDate?.toISOString() ?? null,
        },
      })
      .then(({ data, error }) => {
        if (!error && data?.asana_gid) onGid(data.asana_gid);
      })
      .catch(() => { /* non-blocking */ });
  }

  syncUpdateTask(asanaGid: string, changes: Partial<Task>): void {
    if (!this.isConnected() || !asanaGid) return;
    const body: Record<string, unknown> = { action: 'updateTask', asanaGid };
    if ('title' in changes)       body['title']       = changes.title;
    if ('description' in changes) body['description'] = changes.description;
    if ('priority' in changes)    body['priority']    = changes.priority;
    if ('dueDate' in changes)     body['dueDate']     = changes.dueDate?.toISOString() ?? null;
    this.supabase.functions.invoke('asana-proxy', { body }).catch(() => { /* non-blocking */ });
  }

  syncCompleteTask(asanaGid: string): void {
    if (!this.isConnected() || !asanaGid) return;
    this.supabase.functions
      .invoke('asana-proxy', { body: { action: 'completeTask', asanaGid } })
      .catch(() => { /* non-blocking */ });
  }

  syncRestoreTask(asanaGid: string): void {
    if (!this.isConnected() || !asanaGid) return;
    this.supabase.functions
      .invoke('asana-proxy', { body: { action: 'restoreTask', asanaGid } })
      .catch(() => { /* non-blocking */ });
  }

  syncDeleteTask(asanaGid: string): void {
    if (!this.isConnected() || !asanaGid) return;
    this.supabase.functions
      .invoke('asana-proxy', { body: { action: 'deleteTask', asanaGid } })
      .catch(() => { /* non-blocking */ });
  }
}
