import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CalendarApiService } from './calendar-api.service';
import { UiStateService } from '../../core/services/ui-state.service';
import { Task } from '../../core/models/task.model';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { addDays, formatTime12, toISO } from '../../shared/utilities/date.utils';
import { getPriorityColor } from '../../shared/utilities/priority.utils';

type CalMode = 'month' | 'week' | 'day';

@Component({
  selector: 'tf-calendar',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="view">
      <header class="view-header">
        <div>
          <h1 class="view-title">Calendar</h1>
          <p class="view-subtitle">{{ rangeLabel() }}</p>
        </div>
        <div class="view-actions">
          <div class="view-toggle" role="group" aria-label="Calendar mode">
            @for (m of modes; track m) {
              <button type="button" class="view-toggle-btn" [class.is-active]="mode() === m" (click)="setMode(m)">
                {{ m[0].toUpperCase() + m.slice(1) }}
              </button>
            }
          </div>
          <div class="cal-nav">
            <button class="icon-btn icon-btn-sm" type="button" (click)="shift(-1)" aria-label="Previous">
              <tf-icon name="chevron-left" [size]="16" />
            </button>
            <button class="btn btn-ghost btn-sm" type="button" (click)="today()">Today</button>
            <button class="icon-btn icon-btn-sm" type="button" (click)="shift(1)" aria-label="Next">
              <tf-icon name="chevron-right" [size]="16" />
            </button>
          </div>
        </div>
      </header>

      @if (mode() === 'month') {
        <div class="calendar-month">
          <div class="cal-weekday-row">
            @for (w of weekdays; track w) { <div class="cal-weekday">{{ w }}</div> }
          </div>
          <div class="cal-grid">
            @for (d of days(); track d.iso) {
              <button
                type="button"
                class="cal-cell"
                [class.is-outside]="!d.inMonth"
                [class.is-today]="d.isToday"
                (click)="onDay(d.iso)"
              >
                <span class="cal-date-num">{{ d.day }}</span>
                <span class="cal-cell-tasks">
                  @for (t of tasksFor(d.iso).slice(0, 2); track t.id) {
                    <span class="cal-task-chip" [style.--priority-color]="color(t)">{{ t.title }}</span>
                  }
                  @if (tasksFor(d.iso).length > 2) {
                    <span class="cal-more">+{{ tasksFor(d.iso).length - 2 }} more</span>
                  }
                </span>
              </button>
            }
          </div>
        </div>
      } @else {
        <div class="calendar-agenda">
          @for (d of agendaDays(); track d.iso) {
            <div class="agenda-row">
              <div class="agenda-time">{{ d.label }}</div>
              <div class="agenda-tasks">
                @for (t of tasksFor(d.iso); track t.id) {
                  <button type="button" class="task-card" [style.--priority-color]="color(t)" (click)="ui.openTaskDetail(t.id)">
                    <span class="task-body">
                      <span class="task-title">{{ t.title }}</span>
                      <span class="task-meta">
                        <span class="meta-chip">{{ t.dueTime ? time(t.dueTime) : 'All day' }}</span>
                        <span class="meta-priority">{{ t.priority }}</span>
                      </span>
                    </span>
                  </button>
                } @empty { <span class="rail-empty">No tasks</span> }
              </div>
            </div>
          }
        </div>
      }
    </section>
  `,
})
export class CalendarComponent implements OnInit {
  private readonly api = inject(CalendarApiService);
  readonly ui = inject(UiStateService);

  readonly modes: CalMode[] = ['month', 'week', 'day'];
  readonly weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  readonly mode = signal<CalMode>('month');
  readonly cursor = signal(new Date());
  readonly tasks = signal<Task[]>([]);

  readonly rangeLabel = computed(() => {
    const c = this.cursor();
    if (this.mode() === 'month') return c.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (this.mode() === 'day') return c.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const start = addDays(c, -c.getDay());
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${addDays(start, 6).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  });

  readonly days = computed(() => {
    const c = this.cursor();
    const first = new Date(c.getFullYear(), c.getMonth(), 1);
    const start = addDays(first, -first.getDay());
    const now = new Date();
    return Array.from({ length: 42 }, (_, i) => {
      const d = addDays(start, i);
      return {
        iso: toISO(d),
        day: d.getDate(),
        inMonth: d.getMonth() === c.getMonth(),
        isToday: toISO(d) === toISO(now),
      };
    });
  });

  readonly agendaDays = computed(() => {
    const c = this.cursor();
    if (this.mode() === 'day') {
      return [{ iso: toISO(c), label: c.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }) }];
    }
    const start = addDays(c, -c.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      return { iso: toISO(d), label: d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }) };
    });
  });

  tasksFor(iso: string): Task[] {
    return this.tasks()
      .filter((t) => t.dueDate === iso)
      .sort((a, b) => (a.dueTime ?? '99').localeCompare(b.dueTime ?? '99'));
  }

  color(t: Task): string {
    return getPriorityColor(t.priority);
  }
  time(v: string): string {
    return formatTime12(v);
  }

  setMode(m: CalMode): void {
    this.mode.set(m);
    this.load();
  }

  shift(dir: number): void {
    const c = this.cursor();
    if (this.mode() === 'month') this.cursor.set(new Date(c.getFullYear(), c.getMonth() + dir, 1));
    else this.cursor.set(addDays(c, dir * (this.mode() === 'week' ? 7 : 1)));
    this.load();
  }

  today(): void {
    this.cursor.set(new Date());
    this.load();
  }

  onDay(iso: string): void {
    if (this.tasksFor(iso).length === 0) this.ui.openQuickAdd(iso);
  }

  private load(): void {
    const range =
      this.mode() === 'month'
        ? [this.days()[0].iso, this.days()[41].iso]
        : [this.agendaDays()[0].iso, this.agendaDays()[this.agendaDays().length - 1].iso];
    this.api.getCalendarTasks(range[0], range[1]).subscribe({
      next: (r) => r.success && r.data && this.tasks.set(r.data),
      error: () => {},
    });
  }

  ngOnInit(): void {
    this.load();
  }
}
