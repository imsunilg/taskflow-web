import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { TaskStore } from '../../core/services/task.store';
import { UiStateService } from '../../core/services/ui-state.service';
import { TaskCardComponent } from '../../shared/components/task-card/task-card.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { Task, GroupKey, SortKey } from '../../core/models/task.model';
import { addDays, isSameDay, parseISO } from '../../shared/utilities/date.utils';
import { PRIORITY_LABEL, PRIORITY_ORDER } from '../../shared/utilities/priority.utils';

type ViewKey = 'today' | 'upcoming' | 'all' | 'important' | 'overdue' | 'inbox' | 'completed';

const VIEW_META: Record<ViewKey, [string, string]> = {
  today: ['Today', 'Everything due today'],
  upcoming: ['Upcoming', 'Everything scheduled ahead'],
  all: ['All tasks', 'Every active task across categories'],
  important: ['Important', "Tasks you've starred"],
  overdue: ['Overdue', 'Past due and still open'],
  inbox: ['Inbox', 'Tasks without a scheduled date'],
  completed: ['Completed', 'Tasks you have finished'],
};

interface Group {
  label: string;
  color?: string;
  items: Task[];
}

@Component({
  selector: 'tf-tasks',
  standalone: true,
  imports: [TaskCardComponent, IconComponent, ScrollingModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="view">
      <header class="view-header">
        <div>
          <h1 class="view-title">{{ meta()[0] }}</h1>
          <p class="view-subtitle">{{ meta()[1] }}</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-ghost btn-sm" type="button" (click)="ui.toggleFilterPanel()">
            <tf-icon name="filter" [size]="15" /> Filter
            @if (activeFilterCount() > 0) { <span class="filter-badge">{{ activeFilterCount() }}</span> }
          </button>
          <select class="tf-select" [value]="store.sortBy()" (change)="onSort($event)" aria-label="Sort tasks">
            <option value="due">Sort: Due date</option>
            <option value="priority">Sort: Priority</option>
            <option value="created">Sort: Created</option>
            <option value="updated">Sort: Last updated</option>
            <option value="alpha">Sort: Alphabetical</option>
          </select>
          <div class="view-toggle" role="group" aria-label="Group by">
            @for (g of groupOptions; track g.key) {
              <button
                type="button"
                class="view-toggle-btn"
                [class.is-active]="store.groupBy() === g.key"
                (click)="store.groupBy.set(g.key)"
              >
                {{ g.label }}
              </button>
            }
          </div>
        </div>
      </header>

      @if (chips().length) {
        <div class="active-filter-chips">
          @for (c of chips(); track c.key) {
            <span class="active-chip">
              {{ c.label }}
              <button type="button" (click)="removeChip(c)" [attr.aria-label]="'Remove ' + c.label">×</button>
            </span>
          }
        </div>
      }

      @if (store.loading() && list().length === 0) {
        <div class="task-list">
          @for (i of [1, 2, 3, 4, 5]; track i) {
            <div class="task-card-skeleton">
              <div class="skeleton-block" style="width:20px;height:20px;border-radius:50%"></div>
              <div style="flex:1">
                <div class="skeleton-block" style="width:55%;height:14px;margin-bottom:8px"></div>
                <div class="skeleton-block" style="width:32%;height:11px"></div>
              </div>
            </div>
          }
        </div>
      } @else if (list().length === 0) {
        <div class="empty-state">
          <div class="empty-illustration">{{ view() === 'overdue' ? '✓' : '☾' }}</div>
          <h3>{{ view() === 'overdue' ? 'Nothing overdue' : 'Nothing here' }}</h3>
          <p>
            {{
              view() === 'overdue'
                ? "You're on top of every deadline."
                : 'Try adjusting your filters, or add a new task to get started.'
            }}
          </p>
        </div>
      } @else if (list().length > 120) {
        <cdk-virtual-scroll-viewport itemSize="96" class="tf-viewport">
          <tf-task-card
            *cdkVirtualFor="let t of list(); trackBy: trackById"
            [task]="t"
            (open)="ui.openTaskDetail($event)"
            (toggleComplete)="store.toggleComplete($event)"
            (toggleImportant)="store.toggleImportant($event)"
          />
        </cdk-virtual-scroll-viewport>
      } @else {
        <div class="task-groups">
          @for (grp of groups(); track grp.label) {
            <div>
              <div class="task-group-label">
                @if (grp.color) { <span class="dot" [style.background]="grp.color"></span> }
                <span>{{ grp.label }}</span>
                <span class="count">· {{ grp.items.length }}</span>
              </div>
              <div class="task-list">
                @for (t of grp.items; track t.id) {
                  <tf-task-card
                    [task]="t"
                    (open)="ui.openTaskDetail($event)"
                    (toggleComplete)="store.toggleComplete($event)"
                    (toggleImportant)="store.toggleImportant($event)"
                  />
                }
              </div>
            </div>
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      .tf-viewport {
        height: calc(100vh - 220px);
      }
      .tf-viewport tf-task-card {
        display: block;
        padding-bottom: 8px;
      }
    `,
  ],
})
export class TasksComponent {
  readonly store = inject(TaskStore);
  readonly ui = inject(UiStateService);
  private readonly route = inject(ActivatedRoute);

  readonly groupOptions: { key: GroupKey; label: string }[] = [
    { key: 'date', label: 'By date' },
    { key: 'category', label: 'By category' },
    { key: 'priority', label: 'By priority' },
  ];

  readonly view = toSignal(
    this.route.data.pipe(map((d) => (d['view'] as ViewKey) ?? 'all')),
    { initialValue: 'all' as ViewKey },
  );
  private readonly params = toSignal(this.route.queryParamMap, { initialValue: null });

  readonly meta = computed(() => VIEW_META[this.view()]);

  trackById = (_: number, t: Task) => t.id;

  constructor() {
    // Push route query params (search / category / tag) into the store filter.
    effect(() => {
      const p = this.params();
      const search = p?.get('search') ?? undefined;
      const category = p?.get('category') ?? undefined;
      const tag = p?.get('tag') ?? undefined;
      this.store.filterState.update((f) => ({
        ...f,
        search: search || undefined,
        categoryId: category ? [category] : f.categoryId,
        tagIds: tag ? [tag] : f.tagIds,
      }));
    });

    effect(() => {
      this.view();
      this.store.loadTasks();
    });
  }

  private baseList(): Task[] {
    switch (this.view()) {
      case 'today':
        return this.store.todayTasks();
      case 'upcoming':
        return this.store.upcomingTasks();
      case 'important':
        return this.store.importantTasks();
      case 'overdue':
        return this.store.overdueTasks();
      case 'inbox':
        return this.store.inboxTasks();
      case 'completed':
        return this.store.completedTasks();
      default:
        return this.store.visibleTasks();
    }
  }

  readonly list = computed<Task[]>(() => {
    let items = this.baseList();
    if (this.view() !== 'all') {
      // apply cross-cutting filters on the scoped lists too
      const f = this.store.filterState();
      if (f.priority?.length) items = items.filter((t) => f.priority!.includes(t.priority));
      if (f.categoryId?.length) items = items.filter((t) => t.categoryId && f.categoryId!.includes(t.categoryId));
      if (f.tagIds?.length) items = items.filter((t) => t.tags.some((tag) => f.tagIds!.includes(tag)));
      if (f.recurringOnly) items = items.filter((t) => !!t.recurrenceRule);
      if (f.hasReminder) items = items.filter((t) => !!t.reminder);
      if (f.search) {
        const q = f.search.toLowerCase();
        items = items.filter((t) => t.title.toLowerCase().includes(q));
      }
    }
    return this.sort(items, this.store.sortBy());
  });

  private sort(items: Task[], key: SortKey): Task[] {
    const cmp: Record<SortKey, (a: Task, b: Task) => number> = {
      due: (a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'),
      priority: (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
      created: (a, b) => b.createdAt.localeCompare(a.createdAt),
      updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      alpha: (a, b) => a.title.localeCompare(b.title),
    };
    return [...items].sort(cmp[key]);
  }

  readonly groups = computed<Group[]>(() => {
    const items = this.list();
    const key = this.store.groupBy();
    const today = new Date(new Date().toDateString());

    if (key === 'priority') {
      return (['Urgent', 'High', 'Medium', 'Low'] as const)
        .map((p) => ({
          label: PRIORITY_LABEL[p],
          color: `var(--p-${p.toLowerCase()})`,
          items: items.filter((t) => t.priority === p),
        }))
        .filter((g) => g.items.length);
    }

    if (key === 'category') {
      const names = new Map<string, Group>();
      for (const t of items) {
        const label = t.categoryName ?? 'No category';
        if (!names.has(label)) names.set(label, { label, color: t.categoryColor ?? undefined, items: [] });
        names.get(label)!.items.push(t);
      }
      return [...names.values()];
    }

    const buckets: Record<string, Task[]> = {
      Overdue: [],
      Today: [],
      Tomorrow: [],
      'This week': [],
      Later: [],
      'No due date': [],
    };
    for (const t of items) {
      if (!t.dueDate) buckets['No due date'].push(t);
      else {
        const d = parseISO(t.dueDate);
        if (!t.completed && d < today) buckets['Overdue'].push(t);
        else if (isSameDay(d, today)) buckets['Today'].push(t);
        else if (isSameDay(d, addDays(today, 1))) buckets['Tomorrow'].push(t);
        else if (d <= addDays(today, 7)) buckets['This week'].push(t);
        else buckets['Later'].push(t);
      }
    }
    const colors: Record<string, string | undefined> = { Overdue: 'var(--danger)' };
    return Object.entries(buckets)
      .filter(([, v]) => v.length)
      .map(([label, v]) => ({ label, color: colors[label], items: v }));
  });

  readonly activeFilterCount = computed(() => {
    const f = this.store.filterState();
    return (
      (f.status?.length ?? 0) +
      (f.priority?.length ?? 0) +
      (f.categoryId?.length ?? 0) +
      (f.tagIds?.length ?? 0) +
      (f.dueDate ? 1 : 0) +
      (f.recurringOnly ? 1 : 0) +
      (f.hasReminder ? 1 : 0)
    );
  });

  readonly chips = computed(() => {
    const f = this.store.filterState();
    const out: { key: string; label: string; group: string; value?: string }[] = [];
    f.priority?.forEach((p) => out.push({ key: 'p' + p, label: p, group: 'priority', value: p }));
    f.status?.forEach((s) => out.push({ key: 's' + s, label: s, group: 'status', value: s }));
    f.categoryId?.forEach((c) => out.push({ key: 'c' + c, label: 'Category', group: 'categoryId', value: c }));
    f.tagIds?.forEach((t) => out.push({ key: 't' + t, label: '#' + t, group: 'tagIds', value: t }));
    if (f.dueDate) out.push({ key: 'due', label: f.dueDate, group: 'dueDate' });
    if (f.recurringOnly) out.push({ key: 'rec', label: 'Recurring only', group: 'recurringOnly' });
    if (f.hasReminder) out.push({ key: 'rem', label: 'Has reminder', group: 'hasReminder' });
    return out;
  });

  removeChip(c: { group: string; value?: string }): void {
    this.store.filterState.update((f) => {
      const next = { ...f } as Record<string, unknown>;
      if (c.group === 'dueDate' || c.group === 'recurringOnly' || c.group === 'hasReminder') {
        delete next[c.group];
      } else {
        const arr = ((f as Record<string, string[] | undefined>)[c.group] ?? []).filter((x) => x !== c.value);
        next[c.group] = arr.length ? arr : undefined;
      }
      return next as typeof f;
    });
  }

  onSort(e: Event): void {
    this.store.sortBy.set((e.target as HTMLSelectElement).value as SortKey);
  }
}
