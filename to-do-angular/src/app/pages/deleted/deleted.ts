import { Component, inject } from '@angular/core';
import { TaskService } from '../../services/task.service';
import { TaskTableComponent } from '../../components/task-table/task-table';

@Component({
  selector: 'app-deleted',
  standalone: true,
  imports: [TaskTableComponent],
  templateUrl: './deleted.html',
  styleUrl: './deleted.scss',
})
export class DeletedComponent {
  protected taskService = inject(TaskService);
}
