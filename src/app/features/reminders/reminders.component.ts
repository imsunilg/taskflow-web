import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { Reminder } from '../../core/models/task.model';
import { ReminderLabelPipe } from '../../shared/pipes/reminder-label.pipe';

@Component({
  selector: 'tf-reminders',
  standalone: true,
  imports: [DatePipe, ReminderLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="view">
      <header class="view-header">
        <div>
          <h1 class="view-title">Reminders</h1>
          <p class="view-subtitle">Every reminder attached to your tasks</p>
        </div>
      </header>

      @if (reminders().length) {
        <div class="task-list">
          @for (r of reminders(); track r.id) {
            <div class="task-card" style="--priority-color: var(--accent)">
              <span class="task-body">
                <span class="task-title">{{ r.firesAt | date: 'EEE MMM d, h:mm a' }}</span>
                <span class="task-meta">
                  <span class="meta-chip">{{ r.offsetMinutes | reminderLabel }}</span>
                  <span class="meta-chip" [class.is-overdue]="!r.deliveredAt">
                    {{ r.deliveredAt ? 'Delivered' : 'Pending' }}
                  </span>
                </span>
              </span>
            </div>
          }
        </div>
      } @else {
        <div class="empty-state">
          <div class="empty-illustration">⏰</div>
          <h3>No reminders</h3>
          <p>Add a reminder when creating or editing a task with a due date and time.</p>
        </div>
      }
    </section>
  `,
})
export class RemindersComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly reminders = signal<Reminder[]>([]);

  ngOnInit(): void {
    this.api.get<Reminder[]>('/reminders').subscribe({
      next: (r) => r.data && this.reminders.set(r.data),
      error: () => {},
    });
  }
}
