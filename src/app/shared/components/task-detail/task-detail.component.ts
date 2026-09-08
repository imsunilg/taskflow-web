import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';
import { TaskApiService } from '../../../features/tasks/task-api.service';
import { TaskStore } from '../../../core/services/task.store';
import { UiStateService } from '../../../core/services/ui-state.service';
import { ToastService } from '../../../core/services/toast.service';
import { Task, UpdateTaskRequest } from '../../../core/models/task.model';
import { SubtaskRowComponent } from '../subtask-row/subtask-row.component';
import { IconComponent } from '../icon/icon.component';
import { RelativeDatePipe } from '../../pipes/relative-date.pipe';
import { ReminderLabelPipe } from '../../pipes/reminder-label.pipe';

@Component({
  selector: 'tf-task-detail',
  standalone: true,
  imports: [FormsModule, DatePipe, SubtaskRowComponent, IconComponent, RelativeDatePipe, ReminderLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="side-panel side-panel-wide" role="dialog" aria-label="Task details">
      <div class="side-panel-header">
        <button class="icon-btn" type="button" (click)="ui.closeTaskDetail()" aria-label="Close">
          <tf-icon name="x" [size]="18" />
        </button>
        <div class="detail-header-actions">
          <button
            class="icon-btn icon-btn-sm"
            type="button"
            (click)="toggleImportant()"
            [style.color]="task()?.important ? 'var(--accent)' : ''"
            aria-label="Toggle important"
          >
            <tf-icon name="star" [size]="16" />
          </button>
          <button class="icon-btn icon-btn-sm" type="button" (click)="remove()" aria-label="Delete task">
            <tf-icon name="trash" [size]="16" />
          </button>
        </div>
      </div>

      <div class="side-panel-body">
        @if (task(); as t) {
          <div class="checkbox-row" style="margin-bottom:14px">
            <button
              type="button"
              class="task-checkbox"
              [class.is-checked]="t.completed"
              (click)="store.toggleComplete(t.id)"
              style="margin:0"
              aria-label="Toggle complete"
            >
              <tf-icon name="check" [size]="11" [strokeWidth]="3" />
            </button>
            <span [style.color]="t.completed ? 'var(--success)' : 'var(--text-secondary)'" style="font-weight:600">
              {{ t.completed ? 'Completed' : 'Active' }}
            </span>
          </div>

          <input class="detail-title" [ngModel]="t.title" (ngModelChange)="patch({ title: $event })" aria-label="Title" />
          <textarea
            class="detail-desc"
            rows="2"
            placeholder="Add a description…"
            [ngModel]="t.description"
            (ngModelChange)="patch({ description: $event })"
          ></textarea>

          <div class="detail-section">
            <div class="detail-section-title">Details</div>
            <div class="detail-grid">
              <div class="detail-field">
                <div class="detail-field-label">Due date</div>
                <input type="date" [ngModel]="t.dueDate" (ngModelChange)="patch({ dueDate: $event || null })" />
              </div>
              <div class="detail-field">
                <div class="detail-field-label">Due time</div>
                <input type="time" [ngModel]="t.dueTime" (ngModelChange)="patch({ dueTime: $event || null })" />
              </div>
              <div class="detail-field">
                <div class="detail-field-label">Priority</div>
                <select [ngModel]="t.priority" (ngModelChange)="patch({ priority: $event })">
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
              <div class="detail-field">
                <div class="detail-field-label">Reminder</div>
                <div class="detail-field-value">
                  {{ t.reminder ? (t.reminder.offsetMinutes | reminderLabel) : 'None' }}
                </div>
              </div>
              <div class="detail-field">
                <div class="detail-field-label">Repeat</div>
                <div class="detail-field-value">{{ t.recurrenceRule ? t.recurrenceRule.frequency : 'Does not repeat' }}</div>
              </div>
              <div class="detail-field">
                <div class="detail-field-label">Category</div>
                <div class="detail-field-value">{{ t.categoryName || 'None' }}</div>
              </div>
            </div>
            @if (t.tags.length) {
              <div class="task-meta" style="margin-top:10px">
                @for (tag of t.tags; track tag) { <span class="tag-pill">#{{ tag }}</span> }
              </div>
            }
          </div>

          <div class="detail-section">
            <div class="subtask-progress-header">
              <span>Subtasks</span>
              <span>{{ doneCount() }} / {{ t.subtasks.length }} completed</span>
            </div>
            @if (t.subtasks.length) {
              <div class="subtask-progress-track" style="max-width:100%;margin-bottom:12px">
                <div class="subtask-progress-fill" [style.width.%]="progressPct()"></div>
              </div>
            }
            <div class="subtask-list">
              @for (s of t.subtasks; track s.id) {
                <tf-subtask-row
                  [subtask]="s"
                  (toggle)="toggleSub(t.id, s.id, !s.isDone)"
                  (remove)="removeSub(t.id, s.id)"
                />
              }
            </div>
            <form (submit)="addSub($event, t.id)" style="margin-top:6px">
              <input class="tf-input" [(ngModel)]="newSub" name="newSub" placeholder="Add a subtask…" />
            </form>
          </div>

          @if (t.reminder) {
            <div class="detail-section">
              <div class="detail-section-title">Reminder</div>
              <div class="transcript-box">
                Fires {{ t.reminder.firesAt | relativeDate }} — {{ t.reminder.offsetMinutes | reminderLabel }}
              </div>
            </div>
          }

          <div class="detail-section">
            <div class="detail-section-title">Notes</div>
            <textarea
              class="detail-desc"
              rows="2"
              style="margin-bottom:0"
              [ngModel]="t.notes"
              (ngModelChange)="patch({ notes: $event })"
            ></textarea>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">Activity</div>
            <div class="activity-list">
              @for (h of t.history; track h.id) {
                <div class="activity-item">
                  <span class="activity-dot"></span>
                  <div>
                    <div class="activity-text">{{ h.changeText }}</div>
                    <div class="activity-time">{{ h.changedAt | date: 'MMM d, h:mm a' }}</div>
                  </div>
                </div>
              } @empty { <div class="muted">No activity yet.</div> }
            </div>
          </div>
        } @else {
          <div class="empty-state" style="padding:48px 0"><div class="voice-spinner"></div></div>
        }
      </div>
    </aside>
  `,
})
export class TaskDetailComponent {
  private readonly taskApi = inject(TaskApiService);
  readonly store = inject(TaskStore);
  readonly ui = inject(UiStateService);
  private readonly toast = inject(ToastService);

  readonly task = signal<Task | null>(null);
  newSub = '';
  private readonly save$ = new Subject<UpdateTaskRequest>();

  readonly doneCount = computed(() => this.task()?.subtasks.filter((s) => s.isDone).length ?? 0);
  readonly progressPct = computed(() => {
    const total = this.task()?.subtasks.length ?? 0;
    return total ? (this.doneCount() / total) * 100 : 0;
  });

  constructor() {
    effect(() => {
      const id = this.ui.detailTaskId();
      this.task.set(null);
      if (id && !id.startsWith('temp-')) {
        this.taskApi.getTask(id).subscribe({ next: (r) => r.data && this.task.set(r.data) });
      } else if (id) {
        this.task.set(this.store.tasks().find((t) => t.id === id) ?? null);
      }
    });

    this.save$.pipe(debounceTime(500)).subscribe((patch) => {
      const t = this.task();
      if (t && !t.id.startsWith('temp-')) this.store.updateTask(t.id, patch);
    });
  }

  patch(patch: UpdateTaskRequest): void {
    this.task.update((t) => (t ? ({ ...t, ...patch } as Task) : t));
    this.save$.next(patch);
  }

  toggleImportant(): void {
    const t = this.task();
    if (t) {
      this.task.update((x) => (x ? { ...x, important: !x.important } : x));
      this.store.toggleImportant(t.id);
    }
  }

  addSub(e: Event, taskId: string): void {
    e.preventDefault();
    if (!this.newSub.trim()) return;
    this.taskApi.createSubtask(taskId, { text: this.newSub.trim() }).subscribe({
      next: (r) => {
        if (r.data) this.task.update((t) => (t ? { ...t, subtasks: [...t.subtasks, r.data!] } : t));
        this.newSub = '';
      },
    });
  }

  toggleSub(taskId: string, subtaskId: string, isDone: boolean): void {
    this.taskApi.updateSubtask(taskId, subtaskId, { isDone }).subscribe({
      next: () =>
        this.task.update((t) =>
          t ? { ...t, subtasks: t.subtasks.map((s) => (s.id === subtaskId ? { ...s, isDone } : s)) } : t,
        ),
    });
  }

  removeSub(taskId: string, subtaskId: string): void {
    this.taskApi.deleteSubtask(taskId, subtaskId).subscribe({
      next: () => this.task.update((t) => (t ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) } : t)),
    });
  }

  remove(): void {
    const t = this.task();
    if (t && confirm(`Delete "${t.title}"? This can't be undone.`)) {
      this.store.deleteTask(t.id);
      this.ui.closeTaskDetail();
      this.toast.show('success', 'Task deleted');
    }
  }
}
