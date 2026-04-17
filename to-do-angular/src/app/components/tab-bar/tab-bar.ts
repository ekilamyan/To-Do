import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TaskService } from '../../services/task.service';
import { SubscriptionService } from '../../services/subscription.service';
import { ProChipComponent } from '../pro-chip/pro-chip';

@Component({
  selector: 'app-tab-bar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, ProChipComponent],
  templateUrl: './tab-bar.html',
  styleUrl: './tab-bar.scss',
})
export class TabBarComponent {
  protected taskService = inject(TaskService);
  protected subscriptionService = inject(SubscriptionService);

  onLockedTabClick(e: Event): void {
    e.preventDefault();
    this.subscriptionService.openPricingDialog();
  }
}
