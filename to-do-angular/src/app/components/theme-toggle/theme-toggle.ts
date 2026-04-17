import { Component, inject } from '@angular/core';
import { ThemeService } from '../../services/theme.service';
import { SubscriptionService } from '../../services/subscription.service';
import { ProChipComponent } from '../pro-chip/pro-chip';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [ProChipComponent],
  templateUrl: './theme-toggle.html',
  styleUrl: './theme-toggle.scss',
})
export class ThemeToggleComponent {
  protected themeService = inject(ThemeService);
  protected subscriptionService = inject(SubscriptionService);

  onToggleClick(): void {
    if (!this.subscriptionService.isPro()) {
      this.subscriptionService.openPricingDialog();
      return;
    }
    this.themeService.toggleTheme();
  }
}
