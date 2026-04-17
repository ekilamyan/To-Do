import { Component, input, signal, computed, inject } from '@angular/core';
import { Task, TabType, TaskStatus, SortState, PRIORITY_WEIGHTS, Priority } from '../../models/task.model';
import { TaskService } from '../../services/task.service';
import { SnackbarService } from '../../services/snackbar.service';
import { SubscriptionService } from '../../services/subscription.service';
import { TaskRowComponent } from '../task-row/task-row';
import { InlineCreationRowComponent } from '../inline-creation-row/inline-creation-row';
import { ProChipComponent } from '../pro-chip/pro-chip';
import { CdkDropList, CdkDrag, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-task-table',
  standalone: true,
  imports: [TaskRowComponent, InlineCreationRowComponent, ProChipComponent, CdkDropList, CdkDrag],
  templateUrl: './task-table.html',
  styleUrl: './task-table.scss',
})
export class TaskTableComponent {
  tasks = input.required<Task[]>();
  tabType = input.required<TabType>();

  protected taskService = inject(TaskService);
  private snackbarService = inject(SnackbarService);
  protected subscriptionService = inject(SubscriptionService);

  sortState = signal<SortState>({ column: null, direction: null });

  isDragDisabled = computed(() =>
    this.sortState().column !== null || this.tabType() !== 'active'
  );

  sortedTasks = computed(() => {
    const tasks = [...this.tasks()];
    const state = this.sortState();

    if (!state.column || !state.direction) {
      return tasks.sort((a, b) => a.sortOrder - b.sortOrder);
    }

    const dir = state.direction === 'asc' ? 1 : -1;

    return tasks.sort((a, b) => {
      switch (state.column) {
        case 'title':
          return dir * a.title.localeCompare(b.title);
        case 'description':
          return dir * a.description.localeCompare(b.description);
        case 'priority':
          return dir * (PRIORITY_WEIGHTS[a.priority] - PRIORITY_WEIGHTS[b.priority]);
        case 'dueDate': {
          const aTime = a.dueDate ? a.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
          const bTime = b.dueDate ? b.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
          return dir * (aTime - bTime);
        }
        case 'assignee':
          return dir * a.assignee.localeCompare(b.assignee);
        default:
          return 0;
      }
    });
  });

  toggleSort(column: string): void {
    this.sortState.update(state => {
      if (state.column !== column) {
        return { column, direction: 'asc' };
      }
      if (state.direction === 'asc') {
        return { column, direction: 'desc' };
      }
      return { column: null, direction: null };
    });
  }

  getSortClass(column: string): string {
    const state = this.sortState();
    if (state.column !== column || !state.direction) return '';
    return state.direction === 'asc' ? 'sorted-asc' : 'sorted-desc';
  }

  onDrop(event: CdkDragDrop<Task[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const tasks = [...this.sortedTasks()];
    moveItemInArray(tasks, event.previousIndex, event.currentIndex);
    this.taskService.reorderTasks(tasks.map(t => t.id));
  }

  onSubtaskDrop(parentId: string, event: CdkDragDrop<Task[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const subtasks = [...this.getSubtasks(parentId)];
    moveItemInArray(subtasks, event.previousIndex, event.currentIndex);
    this.taskService.reorderSubtasks(parentId, subtasks.map(t => t.id));
  }

  onCompleteTask(task: Task): void {
    this.taskService.completeTask(task.id);
  }

  onDeleteTask(task: Task): void {
    this.taskService.deleteTask(task.id);
  }

  async onRestoreTask(task: Task): Promise<void> {
    const restored = await this.taskService.restoreTask(task.id);
    if (!restored) {
      this.snackbarService.show('Restore the parent task first before restoring this subtask');
    }
  }

  onPermanentDeleteTask(task: Task): void {
    this.taskService.permanentlyDeleteTask(task.id);
  }

  onToggleExpand(task: Task): void {
    this.taskService.updateTask(task.id, { isExpanded: !task.isExpanded });
  }

  onAddSubtask(task: Task): void {
    if (!task.isExpanded) {
      this.taskService.updateTask(task.id, { isExpanded: true });
    }
    this.taskService.startCreatingTask(task.id);
  }

  onCreationDone(): void {
    this.taskService.stopCreating();
  }

  isPlaceholder(taskId: string): boolean {
    const tab = this.tabType();
    if (tab === 'deleted') return this.taskService.deletedPlaceholderParentIds().has(taskId);
    if (tab === 'completed') return this.taskService.completedPlaceholderParentIds().has(taskId);
    return false;
  }

  getSubtasks(parentId: string): Task[] {
    const tab = this.tabType();
    if (tab === 'deleted') {
      return this.taskService.getSubtasksByStatus(parentId, TaskStatus.Deleted);
    }
    if (tab === 'completed') {
      return this.taskService.getSubtasksByStatus(parentId, TaskStatus.Completed);
    }
    return this.taskService.getSubtasks(parentId).filter(sub => sub.status !== 'deleted');
  }
}
