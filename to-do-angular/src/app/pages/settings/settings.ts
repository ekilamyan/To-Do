import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AsanaService, AsanaProject } from '../../services/asana.service';
import { SubscriptionService } from '../../services/subscription.service';
import { SnackbarService } from '../../services/snackbar.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class SettingsComponent {
  protected asana = inject(AsanaService);
  protected subscriptionService = inject(SubscriptionService);
  private snackbar = inject(SnackbarService);

  protected pat = signal('');
  protected projects = signal<AsanaProject[]>([]);
  protected selectedProjectGid = signal('');
  protected loadingProjects = signal(false);
  protected connecting = signal(false);
  protected disconnecting = signal(false);
  protected refreshing = signal(false);
  protected showPat = signal(false);

  get canFetchProjects(): boolean {
    return this.pat().trim().length > 0;
  }

  get canConnect(): boolean {
    return this.pat().trim().length > 0 && this.selectedProjectGid().length > 0;
  }

  get connectedProjectName(): string {
    return this.projects().find(p => p.gid === this.subscriptionService.asanaProjectGid())?.name
      ?? this.subscriptionService.asanaProjectGid()
      ?? '';
  }

  async onLoadProjects(): Promise<void> {
    if (!this.canFetchProjects) return;
    this.loadingProjects.set(true);
    try {
      const list = await this.asana.fetchProjects(this.pat().trim());
      this.projects.set(list);
      if (list.length === 0) {
        this.snackbar.show('No projects found for this PAT');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load projects';
      this.snackbar.show(msg);
    } finally {
      this.loadingProjects.set(false);
    }
  }

  async onConnect(): Promise<void> {
    if (!this.canConnect) return;
    this.connecting.set(true);
    try {
      await this.asana.connect(this.pat().trim(), this.selectedProjectGid());
      this.pat.set('');
      this.snackbar.show('Connected to Asana');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to connect';
      this.snackbar.show(msg);
    } finally {
      this.connecting.set(false);
    }
  }

  async onRefreshWebhook(): Promise<void> {
    this.refreshing.set(true);
    try {
      await this.asana.reconnect();
      this.snackbar.show('Webhook refreshed — Asana→App sync is now active');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to refresh';
      this.snackbar.show(msg);
    } finally {
      this.refreshing.set(false);
    }
  }

  async onDisconnect(): Promise<void> {
    this.disconnecting.set(true);
    try {
      await this.asana.disconnect();
      this.projects.set([]);
      this.selectedProjectGid.set('');
      this.snackbar.show('Disconnected from Asana');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to disconnect';
      this.snackbar.show(msg);
    } finally {
      this.disconnecting.set(false);
    }
  }

  onPatInput(value: string): void {
    this.pat.set(value);
    this.projects.set([]);
    this.selectedProjectGid.set('');
  }
}
