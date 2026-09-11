import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TaskStore } from '../../core/services/task.store';
import { UiStateService } from '../../core/services/ui-state.service';
import { AuthService } from '../../core/auth/auth.service';
import { TaskCardComponent } from '../../shared/components/task-card/task-card.component';
import { RelativeDatePipe } from '../../shared/pipes/relative-date.pipe';
import { addDays, isSameDay, toISO } from '../../shared/utilities/date.utils';
import { AiApiService } from '../ai/ai-api.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { DailyPlan, NextTaskRecommendation } from '../../core/models/ai.model';

@Component({
  selector: 'tf-dashboard',
  standalone: true,
  imports: [TaskCardComponent, RelativeDatePipe, RouterLink, IconComponent],
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
        <div class="rail-card rail-card-accent">
          <h3><tf-icon name="sparkle" [size]="13" /> Recommended next</h3>
          @if (recommendation(); as rec) {
            <div class="ai-rec-task">{{ rec.title }}</div>
            <ul class="ai-rec-why">
              @for (r of rec.reasons; track r) { <li>{{ r }}</li> }
            </ul>
            <div class="ai-rec-action">{{ rec.suggestedAction }}</div>
            <div class="ai-rec-btns">
              <button type="button" class="btn btn-accent btn-sm" (click)="ui.openTaskDetail(rec.taskId)">Open Task</button>
              <button type="button" class="btn btn-outline btn-sm" (click)="startRecommended(rec.taskId)">Start Task</button>
              <button type="button" class="btn btn-ghost btn-sm" (click)="dismissRecommendation(rec.taskId)">Not Now</button>
            </div>
          } @else {
            <p style="font-size:12.5px;color:var(--text-secondary);margin-bottom:12px">
              Let AI look at your open tasks and tell you what to focus on.
            </p>
            <button type="button" class="btn btn-accent btn-sm" style="width:100%;justify-content:center" (click)="loadRecommendation()">
              <tf-icon name="sparkle" [size]="13" /> What should I do now?
            </button>
          }
        </div>

        <div class="rail-card">
          <h3><tf-icon name="sparkle" [size]="13" /> AI Daily Plan</h3>
          @if (dailyPlan(); as plan) {
            @if (plan.blocks.length) {
              <div class="ai-plan-list">
                @for (b of plan.blocks; track b.taskId) {
                  <div class="ai-plan-row">
                    <div class="ai-plan-bar" [style.background]="'var(--p-' + b.priority.toLowerCase() + ')'"></div>
                    <div class="ai-plan-body">
                      <div class="t">{{ b.start.slice(0, 5) }}–{{ b.end.slice(0, 5) }} · {{ b.title }}</div>
                      <div class="r">{{ b.priority }} priority · {{ b.reason }}</div>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <p class="muted" style="font-size:12.5px">Nothing to schedule right now.</p>
            }
            <button type="button" class="btn btn-ghost btn-sm" style="width:100%;justify-content:center;margin-top:10px" (click)="loadDailyPlan()">
              Regenerate
            </button>
          } @else {
            <p style="font-size:12.5px;color:var(--text-secondary);margin-bottom:12px">
              Let AI turn today's tasks into a time-blocked plan.
            </p>
            <button type="button" class="btn btn-accent btn-sm" style="width:100%;justify-content:center" (click)="loadDailyPlan()">
              <tf-icon name="sparkle" [size]="13" /> Generate Today's Plan
            </button>
          }
        </div>

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
  private readonly aiApi = inject(AiApiService);

  readonly recommendation = signal<NextTaskRecommendation | null>(null);
  readonly dailyPlan = signal<DailyPlan | null>(null);
  private readonly dismissedRecs = signal<string[]>([]);

  loadRecommendation(): void {
    this.aiApi.nextTask(this.dismissedRecs()).subscribe({
      next: (res) => res.success && this.recommendation.set(res.data),
      error: () => {}, // AI unavailable — the card just stays in its "ask AI" state, nothing else on the page is affected
    });
  }

  dismissRecommendation(taskId: string): void {
    this.dismissedRecs.update((list) => [...list, taskId]);
    this.loadRecommendation();
  }

  startRecommended(taskId: string): void {
    this.ui.openTaskDetail(taskId);
  }

  loadDailyPlan(): void {
    this.aiApi.generateDailyPlan().subscribe({
      next: (res) => res.success && this.dailyPlan.set(res.data),
      error: () => {}, // AI unavailable — the card just stays in its "ask AI" state, nothing else on the page is affected
    });
  }

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
