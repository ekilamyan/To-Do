import { Component, inject } from '@angular/core';
import { SubscriptionService } from '../../services/subscription.service';

@Component({
  selector: 'app-pricing-dialog',
  standalone: true,
  templateUrl: './pricing-dialog.html',
  styleUrl: './pricing-dialog.scss',
})
export class PricingDialogComponent {
  protected subscriptionService = inject(SubscriptionService);
  protected loading = false;

  async onUpgrade(): Promise<void> {
    this.loading = true;
    try {
      await this.subscriptionService.startCheckout();
    } catch {
      this.loading = false;
    }
  }
}
