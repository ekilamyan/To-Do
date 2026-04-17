import { Component, input, signal, inject, output, ElementRef, viewChild, afterNextRender } from '@angular/core';
import { Priority } from '../../models/task.model';
import { TaskService } from '../../services/task.service';
import { SubscriptionService } from '../../services/subscription.service';

@Component({
  selector: 'app-inline-creation-row',
  standalone: true,
  templateUrl: './inline-creation-row.html',
  styleUrl: './inline-creation-row.scss',
})
export class InlineCreationRowComponent {
  parentId = input<string | null>(null);
  saved = output<void>();
  cancelled = output<void>();

  protected taskService = inject(TaskService);
  protected subscriptionService = inject(SubscriptionService);

  titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');

  title = signal('');
  description = signal('');
  priority = signal<Priority>(Priority.None);
  dueDate = signal('');
  assignee = signal('');
  isActive = signal(false);

  private cancelPending = false;

  readonly priorities = Object.values(Priority);

  constructor() {
    afterNextRender(() => {
      this.titleInput()?.nativeElement.focus();
    });
  }

  onFocus(): void {
    this.cancelPending = false;
    this.isActive.set(true);
  }

  save(): void {
    this.createTask();
  }

  createTask(): void {
    const titleVal = this.title().trim();
    if (!titleVal) return;

    const partial = {
      title: titleVal,
      description: this.description().trim(),
      priority: this.priority(),
      dueDate: this.dueDate() ? new Date(this.dueDate() + 'T00:00:00') : null,
      assignee: this.assignee().trim(),
    };

    const pid = this.parentId();
    if (pid) {
      this.taskService.addSubtask(pid, partial);
    } else {
      this.taskService.createTask(partial);
    }

    this.resetDraft();
    this.saved.emit();
  }

  onBlur(): void {
    // Defer to allow Save button click to fire first
    this.cancelPending = true;
    setTimeout(() => {
      if (this.cancelPending && !this.title().trim()) {
        this.resetDraft();
        this.cancelled.emit();
      }
    }, 150);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.createTask();
    } else if (event.key === 'Escape') {
      this.resetDraft();
      this.cancelled.emit();
    }
  }

  private resetDraft(): void {
    this.title.set('');
    this.description.set('');
    this.priority.set(Priority.None);
    this.dueDate.set('');
    this.assignee.set('');
    this.isActive.set(false);
  }
}
