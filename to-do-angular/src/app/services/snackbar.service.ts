import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SnackbarService {
  message = signal<string | null>(null);
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  show(msg: string, durationMs = 3000): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.message.set(msg);
    this.timeoutId = setTimeout(() => this.message.set(null), durationMs);
  }

  dismiss(): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.message.set(null);
  }
}
