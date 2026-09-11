import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';
import { TaskApiService } from '../../../features/tasks/task-api.service';
import { TaskStore } from '../../../core/services/task.store';
import { UiStateService } from '../../../core/services/ui-state.service';
import { ToastService } from '../../../core/services/toast.service';
import { AiApiService } from '../../../features/ai/ai-api.service';
import { Task, UpdateTaskRequest } from '../../../core/models/task.model';
import { TaskAnalysis, SubtaskNode } from '../../../core/models/ai.model';
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
            <div class="detail-section-title"><tf-icon name="sparkle" [size]="12" /> AI Actions</div>
            <div class="ai-card-btns">
              <button type="button" class="btn btn-outline btn-sm" (click)="analyzeWithAi(t.id)" [disabled]="aiAnalyzing()">
                <tf-icon name="sparkle" [size]="13" /> {{ aiAnalyzing() ? 'Analyzing…' : 'Analyze with AI' }}
              </button>
              <button type="button" class="btn btn-outline btn-sm" (click)="breakDownWithAi(t.id, t.title, t.description)" [disabled]="aiBreakingDown()">
                <tf-icon name="layers" [size]="13" /> {{ aiBreakingDown() ? 'Thinking…' : 'Break down with AI' }}
              </button>
            </div>

            @if (aiAnalysis(); as a) {
              <div class="ai-analysis-grid">
                <div class="ai-analysis-field"><div class="k">Priority</div><div class="v">{{ a.priority }}</div></div>
                <div class="ai-analysis-field"><div class="k">Estimated effort</div><div class="v">{{ a.estimatedEffort }}</div></div>
                <div class="ai-analysis-field"><div class="k">Complexity</div><div class="v">{{ a.complexity }}</div></div>
                <div class="ai-analysis-field"><div class="k">Suggested deadline</div><div class="v">{{ a.suggestedDeadline }}</div></div>
              </div>
              <div class="ai-analysis-note"><b>Potential blocker</b><br />{{ a.potentialBlocker }}</div>
              <div class="ai-analysis-note" style="margin-top:8px"><b>Recommended next action</b><br />{{ a.recommendedNextAction }}</div>
            }

            @if (aiBreakdownRows(); as rows) {
              <div style="margin-top:12px">
                @for (row of rows; track row.i) {
                  <div class="ai-subtask-preview-row">
                    <input type="checkbox" [checked]="row.include" (change)="toggleBreakdownRow(row.i)" />
                    <input type="text" [value]="row.title" (change)="editBreakdownRow(row.i, $event)" />
                  </div>
                }
                <div class="ai-card-btns" style="margin-top:8px">
                  <button type="button" class="btn btn-accent btn-sm" (click)="confirmAiBreakdown(t.id)">Add Selected Subtasks</button>
                  <button type="button" class="btn btn-ghost btn-sm" (click)="aiBreakdownRows.set(null)">Cancel</button>
                </div>
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
  private readonly aiApi = inject(AiApiService);

  readonly task = signal<Task | null>(null);
  newSub = '';
  private readonly save$ = new Subject<UpdateTaskRequest>();

  readonly aiAnalyzing = signal(false);
  readonly aiAnalysis = signal<TaskAnalysis | null>(null);
  readonly aiBreakingDown = signal(false);
  readonly aiBreakdownRows = signal<{ i: number; title: string; include: boolean }[] | null>(null);

  readonly doneCount = computed(() => this.task()?.subtasks.filter((s) => s.isDone).length ?? 0);
  readonly progressPct = computed(() => {
    const total = this.task()?.subtasks.length ?? 0;
    return total ? (this.doneCount() / total) * 100 : 0;
  });

  constructor() {
    effect(() => {
      const id = this.ui.detailTaskId();
      this.task.set(null);
      this.aiAnalysis.set(null);
      this.aiBreakdownRows.set(null);
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

  analyzeWithAi(taskId: string): void {
    if (this.aiAnalyzing()) return;
    this.aiAnalyzing.set(true);
    this.aiApi.getTaskAnalysis(taskId).subscribe({
      next: (res) => {
        this.aiAnalyzing.set(false);
        if (res.success && res.data) this.aiAnalysis.set(res.data);
        else this.toast.show('error', res.message || 'Could not analyze this task.');
      },
      error: () => this.aiAnalyzing.set(false),
    });
  }

  breakDownWithAi(taskId: string, title: string, description: string | null): void {
    if (this.aiBreakingDown()) return;
    this.aiBreakingDown.set(true);
    this.aiApi.previewBreakdown(taskId).subscribe({
      next: (res) => {
        this.aiBreakingDown.set(false);
        if (res.success && res.data) {
          this.aiBreakdownRows.set(res.data.subtasks.map((s, i) => ({ i, title: s.title, include: true })));
        } else {
          this.toast.show('error', res.message || 'Could not break this task down.');
        }
      },
      error: () => this.aiBreakingDown.set(false),
    });
  }

  toggleBreakdownRow(i: number): void {
    this.aiBreakdownRows.update((rows) => rows?.map((r) => (r.i === i ? { ...r, include: !r.include } : r)) ?? null);
  }

  editBreakdownRow(i: number, e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this.aiBreakdownRows.update((rows) => rows?.map((r) => (r.i === i ? { ...r, title: value } : r)) ?? null);
  }

  confirmAiBreakdown(taskId: string): void {
    const rows = this.aiBreakdownRows();
    const titles = (rows ?? []).filter((r) => r.include && r.title.trim()).map((r) => r.title.trim());
    if (titles.length === 0) {
      this.aiBreakdownRows.set(null);
      return;
    }
    this.aiApi.confirmBreakdown(taskId, titles).subscribe({
      next: (res) => {
        this.aiBreakdownRows.set(null);
        if (res.success) {
          this.toast.show('success', res.message || `${titles.length} subtask(s) added.`);
          this.taskApi.getTask(taskId).subscribe({ next: (r) => r.data && this.task.set(r.data) });
        } else {
          this.toast.show('error', res.message || 'Could not add those subtasks.');
        }
      },
      error: (err: { message?: string }) => {
        this.aiBreakdownRows.set(null);
        this.toast.show('error', err?.message || 'Could not add those subtasks.');
      },
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
