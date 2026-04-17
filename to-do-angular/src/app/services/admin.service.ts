import { Injectable, inject, signal } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../core/supabase.client';

export interface AdminUser {
  id: string;
  email: string;
  createdAt: string;
  isAdmin: boolean;
  isActive: boolean;
  subscriptionStatus: 'free' | 'active' | 'canceled';
  subscriptionEndDate: string | null;
  stripeSubscriptionId: string | null;
  activeTasks: number;
  completedTasks: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private supabase = inject<SupabaseClient>(SUPABASE_CLIENT);

  readonly users   = signal<AdminUser[]>([]);
  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);

  async loadUsers(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const { data, error } = await this.supabase.functions.invoke('get-admin-users');
      if (error) throw error;
      this.users.set(data.users as AdminUser[]);
    } catch (err) {
      this.error.set((err as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  async deactivateUser(userId: string): Promise<void> {
    const { error } = await this.supabase.functions.invoke('admin-deactivate-user', { body: { userId } });
    if (error) throw error;
    await this.loadUsers();
  }

  async activateUser(userId: string): Promise<void> {
    const { error } = await this.supabase.functions.invoke('admin-activate-user', { body: { userId } });
    if (error) throw error;
    await this.loadUsers();
  }

  async resetPassword(email: string): Promise<void> {
    const { error } = await this.supabase.functions.invoke('admin-reset-password', {
      body: { email, origin: window.location.origin },
    });
    if (error) throw error;
  }

  async createUser(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.functions.invoke('admin-create-user', { body: { email, password } });
    if (error) throw error;
    await this.loadUsers();
  }

  async setAdmin(userId: string, isAdmin: boolean): Promise<void> {
    const { error } = await this.supabase.functions.invoke('admin-set-admin', { body: { userId, isAdmin } });
    if (error) throw error;
    await this.loadUsers();
  }
}
