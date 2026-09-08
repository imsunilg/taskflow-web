import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Task } from '../../../core/models/task.model';
import { RelativeDatePipe } from '../../pipes/relative-date.pipe';
import { ReminderLabelPipe } from '../../pipes/reminder-label.pipe';
import { formatTime12 } from '../../utilities/date.utils';
import { getPriorityColor, PRIORITY_LABEL } from '../../utilities/priority.utils';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'tf-task-card',
  standalone: true,
  imports: [RelativeDatePipe, ReminderLabelPipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="task-card"
      [class.is-completed]="task().completed"
      [class.is-overdue]="isOverdue()"
      [style.--priority-color]="priorityColor()"
    >
      <button
        type="button"
        class="task-checkbox"
        [class.is-checked]="task().completed"
        (click)="toggleComplete.emit(task().id)"
        [attr.aria-label]="(task().completed ? 'Mark incomplete: ' : 'Mark complete: ') + task().title"
      >
        <tf-icon name="check" [size]="11" [strokeWidth]="3" />
      </button>

      <button type="button" class="task-body" (click)="open.emit(task().id)">
        <span class="task-title-row">
          <span class="task-title">{{ task().title }}</span>
          @if (task().important) { <span class="task-star" aria-hidden="true">★</span> }
        </span>

        @if (task().description) {
          <span class="task-desc">{{ task().description }}</span>
        }

        <span class="task-meta">
          @if (task().dueDate) {
            <span class="meta-chip" [class.is-overdue]="isOverdue()">
              <tf-icon name="calendar" [size]="12" />
              {{ isOverdue() ? 'Overdue · ' : '' }}{{ task().dueDate | relativeDate
              }}{{ task().dueTime ? ' · ' + time() : '' }}
            </span>
          }
          @if (task().reminder) {
            <span class="meta-chip" [title]="'Reminder: ' + (task().reminder!.offsetMinutes | reminderLabel)">
              <tf-icon name="bell" [size]="12" />
              {{ task().reminder!.offsetMinutes | reminderLabel }}
            </span>
          }
          @if (task().recurrenceRule) {
            <span class="meta-chip" title="Recurring">
              <tf-icon name="repeat" [size]="12" /> {{ task().recurrenceRule!.frequency }}
            </span>
          }
          <span class="meta-priority">
            <tf-icon name="flag" [size]="12" /> {{ priorityLabel() }}
          </span>
          @if (task().categoryName) {
            <span class="meta-category">
              <span class="meta-cat-dot" [style.background]="task().categoryColor || '#888'"></span>
              {{ task().categoryName }}
            </span>
          }
          @if (task().tags.length) {
            <span class="meta-tags">
              @for (tag of task().tags.slice(0, 2); track tag) {
                <span class="tag-pill">#{{ tag }}</span>
              }
              @if (task().tags.length > 2) {
                <span class="tag-pill">+{{ task().tags.length - 2 }}</span>
              }
            </span>
          }
          @if (task().subtasks.length) {
            <span
              class="subtask-progress-wrap"
              [attr.aria-label]="doneCount() + ' of ' + task().subtasks.length + ' subtasks done'"
            >
              <span class="subtask-progress-track">
                <span class="subtask-progress-fill" [style.width.%]="progressPct()"></span>
              </span>
              <span class="subtask-progress-text">{{ doneCount() }}/{{ task().subtasks.length }}</span>
            </span>
          }
          @if (task().isVoiceCreated) {
            <span class="meta-chip voice-indicator" title="Created by voice">
              <tf-icon name="mic" [size]="12" />
            </span>
          }
        </span>
      </button>

      <button
        type="button"
        class="task-star-btn"
        [class.is-active]="task().important"
        (click)="toggleImportant.emit(task().id)"
        [attr.aria-label]="(task().important ? 'Unmark important: ' : 'Mark important: ') + task().title"
      >
        ★
      </button>
    </article>
  `,
})
export class TaskCardComponent {
  readonly task = input.required<Task>();

  readonly open = output<string>();
  readonly toggleComplete = output<string>();
  readonly toggleImportant = output<string>();

  readonly priorityColor = computed(() => getPriorityColor(this.task().priority));
  readonly priorityLabel = computed(() => PRIORITY_LABEL[this.task().priority]);
  readonly time = computed(() => formatTime12(this.task().dueTime));
  readonly doneCount = computed(() => this.task().subtasks.filter((s) => s.isDone).length);
  readonly progressPct = computed(() => {
    const total = this.task().subtasks.length;
    return total ? (this.doneCount() / total) * 100 : 0;
  });
  readonly isOverdue = computed(() => {
    const t = this.task();
    if (t.completed || !t.dueDate) return false;
    return new Date(t.dueDate) < new Date(new Date().toDateString());
  });
}
