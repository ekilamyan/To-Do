import { Component, input, output, signal, inject } from '@angular/core';
import { Task, TabType, Priority } from '../../models/task.model';
import { TaskService } from '../../services/task.service';
import { SnackbarService } from '../../services/snackbar.service';
import { SubscriptionService } from '../../services/subscription.service';
import { CdkDragHandle } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-task-row',
  standalone: true,
  imports: [CdkDragHandle],
  templateUrl: './task-row.html',
  styleUrl: './task-row.scss',
})
export class TaskRowComponent {
  task = input.required<Task>();
  tabType = input.required<TabType>();
  isSubtask = input(false);
  isPlaceholder = input(false);
  deletedSubtaskCount = input(0);
  parentDeleted = input(false);

  complete = output<void>();
  delete = output<void>();
  restore = output<void>();
  permanentDelete = output<void>();
  toggleExpand = output<void>();
  addSubtask = output<void>();

  protected taskService = inject(TaskService);
  private snackbarService = inject(SnackbarService);
  protected subscriptionService = inject(SubscriptionService);

  editingField = signal<string | null>(null);
  editValue = signal<string>('');
  isEditMode = signal(false);

  readonly priorities = Object.values(Priority);

  toggleEditMode(): void {
    this.isEditMode.update(v => !v);
    if (!this.isEditMode()) {
      this.editingField.set(null);
    }
  }

  startEdit(field: string): void {
    if (!this.isEditMode()) return;
    const task = this.task();
    let value = '';
    switch (field) {
      case 'title': value = task.title; break;
      case 'description': value = task.description; break;
      case 'priority': value = task.priority; break;
      case 'dueDate': value = task.dueDate ? this.formatDateForInput(task.dueDate) : ''; break;
      case 'assignee': value = task.assignee; break;
    }
    this.editValue.set(value);
    this.editingField.set(field);
  }

  commitEdit(field: string): void {
    const value = this.editValue().trim();
    const task = this.task();

    switch (field) {
      case 'title':
        if (value.length > 0) {
          this.taskService.updateTask(task.id, { title: value });
        }
        break;
      case 'description':
        this.taskService.updateTask(task.id, { description: value });
        break;
      case 'priority':
        this.taskService.updateTask(task.id, { priority: value as Priority });
        break;
      case 'dueDate':
        this.taskService.updateTask(task.id, {
          dueDate: value ? new Date(value + 'T00:00:00') : null,
        });
        break;
      case 'assignee':
        this.taskService.updateTask(task.id, { assignee: value });
        if (value) this.taskService.addAssignee(value);
        break;
    }

    this.editingField.set(null);
  }

  cancelEdit(): void {
    this.editingField.set(null);
  }

  exitEditMode(): void {
    this.isEditMode.set(false);
    this.editingField.set(null);
  }

  onKeydown(event: KeyboardEvent, field: string): void {
    if (event.key === 'Enter') {
      this.commitEdit(field);
    } else if (event.key === 'Escape') {
      this.cancelEdit();
    }
  }

  onPriorityClick(): void {
    if (!this.subscriptionService.isPro()) {
      this.subscriptionService.openPricingDialog();
      return;
    }
    this.startEdit('priority');
  }

  onCompleteClick(): void {
    const task = this.task();
    if (task.subtaskIds.length > 0) {
      const subtasks = this.taskService.getSubtasks(task.id);
      const hasIncomplete = subtasks.some(s => s.status !== 'completed');
      if (hasIncomplete) {
        this.snackbarService.show('Complete all subtasks before completing the parent task');
        return;
      }
    }
    this.complete.emit();
  }

  isOverdue(): boolean {
    const task = this.task();
    if (!task.dueDate || task.status !== 'active') return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(task.dueDate);
    due.setHours(0, 0, 0, 0);
    return due < now;
  }

  formatDate(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = new Date(date);
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  formatDateForInput(date: Date): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
