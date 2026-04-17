import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TaskService } from '../../services/task.service';
import { SubscriptionService } from '../../services/subscription.service';
import { SnackbarService } from '../../services/snackbar.service';
import { TaskTableComponent } from '../../components/task-table/task-table';

@Component({
  selector: 'app-active',
  standalone: true,
  imports: [TaskTableComponent],
  templateUrl: './active.html',
  styleUrl: './active.scss',
})
export class ActiveComponent implements OnInit {
  protected taskService = inject(TaskService);
  private subscriptionService = inject(SubscriptionService);
  private snackbarService = inject(SnackbarService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  async ngOnInit(): Promise<void> {
    const upgraded = this.route.snapshot.queryParamMap.get('upgraded');
    if (upgraded === 'true') {
      await this.subscriptionService.loadProfile();
      this.snackbarService.show('Welcome to Taskflow Pro!');
      this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }
}
