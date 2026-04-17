import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminService, AdminUser } from '../../services/admin.service';
import { AuthService } from '../../services/auth.service';
import { SnackbarService } from '../../services/snackbar.service';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog';
import { AdminCreateUserDialogComponent } from '../../components/admin-create-user-dialog/admin-create-user-dialog';

type SortColumn = 'email' | 'createdAt' | 'isActive' | 'subscriptionStatus' | 'subscriptionEndDate' | 'activeTasks' | 'completedTasks';
type SortDirection = 'asc' | 'desc' | null;

interface PendingAction {
  type: 'deactivate' | 'activate' | 'resetPassword' | 'toggleAdmin';
  userId?: string;
  email: string;
  isAdmin?: boolean;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [FormsModule, ConfirmDialogComponent, AdminCreateUserDialogComponent],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class AdminComponent implements OnInit {
  protected adminService  = inject(AdminService);
  protected authService   = inject(AuthService);
  private snackbar        = inject(SnackbarService);
  private router          = inject(Router);

  protected search             = signal('');
  protected subFilter          = signal<'all' | 'free' | 'active' | 'canceled'>('all');
  protected statusFilter       = signal<'all' | 'active' | 'inactive'>('all');
  protected sortColumn         = signal<SortColumn | null>(null);
  protected sortDirection      = signal<SortDirection>(null);
  protected pendingAction      = signal<PendingAction | null>(null);
  protected showCreateDialog   = signal(false);
  protected actionLoading      = signal<string | null>(null); // userId currently processing

  ngOnInit(): void {
    this.adminService.loadUsers();
  }

  protected filteredUsers = computed(() => {
    let users = [...this.adminService.users()];
    const q = this.search().toLowerCase().trim();

    if (q) {
      users = users.filter(u => u.email.toLowerCase().includes(q));
    }

    const sub = this.subFilter();
    if (sub !== 'all') {
      users = users.filter(u => u.subscriptionStatus === sub);
    }

    const status = this.statusFilter();
    if (status === 'active')   users = users.filter(u => u.isActive);
    if (status === 'inactive') users = users.filter(u => !u.isActive);

    const col = this.sortColumn();
    const dir = this.sortDirection();

    if (col && dir) {
      const d = dir === 'asc' ? 1 : -1;
      users.sort((a, b) => {
        const av = a[col as keyof AdminUser];
        const bv = b[col as keyof AdminUser];
        if (av === null || av === undefined) return d;
        if (bv === null || bv === undefined) return -d;
        if (typeof av === 'string' && typeof bv === 'string') return d * av.localeCompare(bv);
        if (typeof av === 'number' && typeof bv === 'number') return d * (av - bv);
        if (typeof av === 'boolean' && typeof bv === 'boolean') return d * (Number(av) - Number(bv));
        return 0;
      });
    }

    return users;
  });

  toggleSort(col: SortColumn): void {
    if (this.sortColumn() !== col) {
      this.sortColumn.set(col);
      this.sortDirection.set('asc');
    } else if (this.sortDirection() === 'asc') {
      this.sortDirection.set('desc');
    } else {
      this.sortColumn.set(null);
      this.sortDirection.set(null);
    }
  }

  formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // --- Action triggers (open confirm dialog) ---

  requestDeactivate(user: AdminUser): void {
    this.pendingAction.set({ type: 'deactivate', userId: user.id, email: user.email });
  }

  requestActivate(user: AdminUser): void {
    this.pendingAction.set({ type: 'activate', userId: user.id, email: user.email });
  }

  requestResetPassword(user: AdminUser): void {
    this.pendingAction.set({ type: 'resetPassword', email: user.email });
  }

  requestToggleAdmin(user: AdminUser): void {
    this.pendingAction.set({ type: 'toggleAdmin', userId: user.id, email: user.email, isAdmin: user.isAdmin });
  }

  cancelAction(): void {
    this.pendingAction.set(null);
  }

  async confirmAction(): Promise<void> {
    const action = this.pendingAction();
    if (!action) return;

    this.pendingAction.set(null);
    this.actionLoading.set(action.userId ?? action.email);

    try {
      switch (action.type) {
        case 'deactivate':
          await this.adminService.deactivateUser(action.userId!);
          this.snackbar.show(`${action.email} has been deactivated.`);
          break;
        case 'activate':
          await this.adminService.activateUser(action.userId!);
          this.snackbar.show(`${action.email} has been activated.`);
          break;
        case 'resetPassword':
          await this.adminService.resetPassword(action.email);
          this.snackbar.show(`Password reset email sent to ${action.email}.`);
          break;
        case 'toggleAdmin': {
          const next = !action.isAdmin;
          await this.adminService.setAdmin(action.userId!, next);
          this.snackbar.show(next ? `${action.email} is now an admin.` : `${action.email} is no longer an admin.`);
          break;
        }
      }
    } catch (err) {
      this.snackbar.show((err as Error).message);
    } finally {
      this.actionLoading.set(null);
    }
  }

  get confirmDialogConfig(): { title: string; message: string; label: string } {
    const a = this.pendingAction();
    if (!a) return { title: '', message: '', label: 'Confirm' };
    switch (a.type) {
      case 'deactivate':
        return { title: 'Deactivate user?', message: `${a.email} will be blocked from logging in and their subscription will be canceled at period end.`, label: 'Deactivate' };
      case 'activate':
        return { title: 'Activate user?', message: `${a.email} will be able to log in again.`, label: 'Activate' };
      case 'resetPassword':
        return { title: 'Send password reset?', message: `A password reset email will be sent to ${a.email}.`, label: 'Send Email' };
      case 'toggleAdmin':
        return a.isAdmin
          ? { title: 'Remove admin?', message: `${a.email} will lose admin privileges.`, label: 'Remove Admin' }
          : { title: 'Make admin?', message: `${a.email} will gain full admin access.`, label: 'Make Admin' };
    }
  }

  isCurrentUser(userId: string): boolean {
    return this.authService.user()?.id === userId;
  }

  goBack(): void {
    this.router.navigate(['/active']);
  }
}
