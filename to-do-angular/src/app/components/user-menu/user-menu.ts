import { Component, inject, signal, HostListener, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SubscriptionService } from '../../services/subscription.service';

@Component({
  selector: 'app-user-menu',
  standalone: true,
  templateUrl: './user-menu.html',
  styleUrl: './user-menu.scss',
})
export class UserMenuComponent {
  protected authService = inject(AuthService);
  protected subscriptionService = inject(SubscriptionService);
  private router = inject(Router);
  private elRef = inject(ElementRef);

  protected open = signal(false);

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: Event): void {
    if (!this.elRef.nativeElement.contains(e.target)) {
      this.open.set(false);
    }
  }

  toggle(): void {
    this.open.update(v => !v);
  }

  formatEndDate(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  async onSignOut(): Promise<void> {
    this.open.set(false);
    await this.authService.signOut();
    this.router.navigate(['/login']);
  }

  async onBillingPortal(): Promise<void> {
    this.open.set(false);
    await this.subscriptionService.openBillingPortal();
  }

  onUpgrade(): void {
    this.open.set(false);
    this.subscriptionService.openPricingDialog();
  }

  goToAdmin(): void {
    this.open.set(false);
    this.router.navigate(['/admin']);
  }

  goToSettings(): void {
    this.open.set(false);
    this.router.navigate(['/settings']);
  }
}
