import { Component, inject, signal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { SnackbarService } from '../../services/snackbar.service';

@Component({
  selector: 'app-admin-create-user-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-create-user-dialog.html',
  styleUrl: './admin-create-user-dialog.scss',
})
export class AdminCreateUserDialogComponent {
  private adminService   = inject(AdminService);
  private snackbar       = inject(SnackbarService);

  closed = output<void>();

  protected email    = signal('');
  protected password = signal('');
  protected loading  = signal(false);
  protected error    = signal<string | null>(null);

  async onSubmit(): Promise<void> {
    if (!this.email() || !this.password()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.adminService.createUser(this.email(), this.password());
      this.snackbar.show(`User ${this.email()} created.`);
      this.closed.emit();
    } catch (err) {
      this.error.set((err as Error).message);
    } finally {
      this.loading.set(false);
    }
  }
}
