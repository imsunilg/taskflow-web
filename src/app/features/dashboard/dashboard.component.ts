import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TaskStore } from '../../core/services/task.store';
import { UiStateService } from '../../core/services/ui-state.service';
import { AuthService } from '../../core/auth/auth.service';
import { TaskCardComponent } from '../../shared/components/task-card/task-card.component';
import { RelativeDatePipe } from '../../shared/pipes/relative-date.pipe';
import { addDays, isSameDay, toISO } from '../../shared/utilities/date.utils';

@Component({
  selector: 'tf-dashboard',
  standalone: true,
  imports: [TaskCardComponent, RelativeDatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="view dashboard-grid">
      <div>
        <header class="view-header">
          <div>
            <h1 class="view-title">{{ greeting() }}, {{ firstName() }}</h1>
            <p class="view-subtitle">{{ today }}</p>
          </div>
        </header>

        <div class="stat-strip">
          <div class="stat-card" style="--stat-color: var(--accent)">
            <div class="stat-value">{{ store.counts().today }}</div>
            <div class="stat-label">Tasks today</div>
          </div>
          <div class="stat-card" style="--stat-color: var(--success)">
            <div class="stat-value">{{ completedToday() }}</div>
            <div class="stat-label">Completed today</div>
          </div>
          <div class="stat-card" style="--stat-color: var(--p-high)">
            <div class="stat-value">{{ highPriority().length }}</div>
            <div class="stat-label">High priority</div>
          </div>
          <div class="stat-card" style="--stat-color: var(--danger)">
            <div class="stat-value">{{ store.counts().overdue }}</div>
            <div class="stat-label">Overdue</div>
          </div>
        </div>

        <div class="section-block">
          <div class="section-header">
            <h2>Today's tasks</h2>
            <a class="text-btn" routerLink="/tasks/today">View all</a>
          </div>
          <div class="task-list">
            @for (t of store.todayTasks().slice(0, 6); track t.id) {
              <tf-task-card
                [task]="t"
                (open)="ui.openTaskDetail($event)"
                (toggleComplete)="store.toggleComplete($event)"
                (toggleImportant)="store.toggleImportant($event)"
              />
            } @empty {
              <div class="empty-state" style="padding:32px 0">
                <div class="empty-illustration">☀</div>
                <h3>Nothing due today</h3>
                <p>Enjoy the clear runway, or pull something in from Upcoming.</p>
              </div>
            }
          </div>
        </div>

        <div class="section-block">
          <div class="section-header">
            <h2>High priority</h2>
            <a class="text-btn" routerLink="/tasks/important">View all</a>
          </div>
          <div class="task-list">
            @for (t of highPriority().slice(0, 5); track t.id) {
              <tf-task-card
                [task]="t"
                (open)="ui.openTaskDetail($event)"
                (toggleComplete)="store.toggleComplete($event)"
                (toggleImportant)="store.toggleImportant($event)"
              />
            } @empty {
              <div class="empty-state" style="padding:32px 0">
                <div class="empty-illustration">✓</div>
                <h3>No high-priority tasks</h3>
                <p>You're on top of the urgent stuff.</p>
              </div>
            }
          </div>
        </div>
      </div>

      <aside class="view-rail">
        <div class="rail-card">
          <h3>Upcoming</h3>
          <div class="rail-list">
            @for (t of store.upcomingTasks().slice(0, 6); track t.id) {
              <button type="button" class="rail-item" (click)="ui.openTaskDetail(t.id)">
                <span class="rail-item-dot" [style.background]="'var(--p-' + t.priority.toLowerCase() + ')'"></span>
                <span class="rail-item-title">{{ t.title }}</span>
                <span class="rail-item-when">{{ t.dueDate | relativeDate }}</span>
              </button>
            } @empty { <div class="rail-empty">Nothing scheduled yet.</div> }
          </div>
        </div>

        <div class="rail-card">
          <h3>Recurring</h3>
          <div class="rail-list">
            @for (t of recurring().slice(0, 6); track t.id) {
              <button type="button" class="rail-item" (click)="ui.openTaskDetail(t.id)">
                <span class="rail-item-dot" style="background: var(--info)"></span>
                <span class="rail-item-title">{{ t.title }}</span>
                <span class="rail-item-when">↻</span>
              </button>
            } @empty { <div class="rail-empty">No recurring tasks.</div> }
          </div>
        </div>

        <div class="rail-card rail-card-accent">
          <h3>This week</h3>
          <div class="rail-week-chart">
            @for (d of week(); track d.iso) {
              <div class="week-bar-wrap">
                <div
                  class="week-bar"
                  [class.is-today]="d.isToday"
                  [class.has-tasks]="!d.isToday && d.count > 0"
                  [style.height.%]="d.height"
                ></div>
                <div class="week-bar-label">{{ d.label }}</div>
              </div>
            }
          </div>
        </div>
      </aside>
    </section>
  `,
})
export class DashboardComponent implements OnInit {
  readonly store = inject(TaskStore);
  readonly ui = inject(UiStateService);
  private readonly auth = inject(AuthService);

  readonly today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  greeting(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }

  firstName(): string {
    return (this.auth.currentUser()?.displayName ?? 'there').split(' ')[0];
  }

  readonly completedToday = computed(() => {
    const iso = toISO(new Date());
    return this.store.completedTasks().filter((t) => t.dueDate === iso || (t.completedAt ?? '').startsWith(iso)).length;
  });

  readonly highPriority = computed(() =>
    this.store.activeTasks().filter((t) => t.priority === 'High' || t.priority === 'Urgent'),
  );

  readonly recurring = computed(() => this.store.activeTasks().filter((t) => !!t.recurrenceRule));

  readonly week = computed(() => {
    const now = new Date();
    const tasks = this.store.tasks();
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(now, i - 3);
      const iso = toISO(d);
      const count = tasks.filter((t) => t.dueDate === iso).length;
      return {
        iso,
        label: d.toLocaleDateString('en-US', { weekday: 'short' })[0],
        count,
        isToday: isSameDay(d, now),
        height: Math.max(10, Math.min(100, count * 28)),
      };
    });
  });

  ngOnInit(): void {
    this.store.loadTasks();
  }
}
