import { Component, inject } from '@angular/core';
import { TaskService } from '../../services/task.service';
import { TaskTableComponent } from '../../components/task-table/task-table';

@Component({
  selector: 'app-completed',
  standalone: true,
  imports: [TaskTableComponent],
  templateUrl: './completed.html',
  styleUrl: './completed.scss',
})
export class CompletedComponent {
  protected taskService = inject(TaskService);
}
