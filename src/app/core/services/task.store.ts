import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, ReplaySubject } from 'rxjs';
import { NormalizedApiError } from '../interceptors/error.interceptor';
import {
  CreateTaskRequest,
  FilterState,
  GroupKey,
  SortKey,
  Task,
  TaskQueryParams,
  UpdateTaskRequest,
} from '../models/task.model';
import { TaskApiService } from '../../features/tasks/task-api.service';
import { ToastService } from './toast.service';
import { PRIORITY_ORDER } from '../../shared/utilities/priority.utils';
import { addDays, endOfWeek, startOfWeek } from '../../shared/utilities/date.utils';

@Injectable({ providedIn: 'root' })
export class TaskStore {
  private readonly taskApi = inject(TaskApiService);
  private readonly toast = inject(ToastService);

  readonly tasks = signal<Task[]>([]);
  readonly loading = signal(false);
  readonly selectedTaskId = signal<string | null>(null);

  readonly filterState = signal<FilterState>({});
  readonly sortBy = signal<SortKey>('due');
  readonly groupBy = signal<GroupKey>('date');

  private get today(): Date {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }

  readonly activeTasks = computed(() => this.tasks().filter((t) => !t.completed));

  readonly todayTasks = computed(() =>
    this.activeTasks().filter((t) => t.dueDate && this.sameDay(t.dueDate, this.today)),
  );

  readonly upcomingTasks = computed(() =>
    this.activeTasks().filter((t) => t.dueDate && new Date(t.dueDate) > this.today),
  );

  readonly overdueTasks = computed(() =>
    this.activeTasks().filter((t) => t.dueDate && new Date(t.dueDate) < this.today),
  );

  readonly importantTasks = computed(() => this.activeTasks().filter((t) => t.important));

  readonly inboxTasks = computed(() => this.activeTasks().filter((t) => !t.dueDate && !t.categoryId));

  readonly completedTasks = computed(() => this.tasks().filter((t) => t.completed));

  readonly thisWeekTasks = computed(() => {
    const s = startOfWeek(this.today);
    const e = endOfWeek(this.today);
    return this.activeTasks().filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d >= s && d <= e;
    });
  });

  readonly counts = computed(() => ({
    today: this.todayTasks().length,
    upcoming: this.upcomingTasks().length,
    overdue: this.overdueTasks().length,
    important: this.importantTasks().length,
    inbox: this.inboxTasks().length,
    all: this.activeTasks().length,
    completed: this.completedTasks().length,
  }));

  /** Client-side filtered + sorted view of the current task list. */
  readonly visibleTasks = computed(() => {
    const f = this.filterState();
    let list = [...this.tasks()];

    if (f.status?.length) {
      list = list.filter((t) => {
        return f.status!.some((s) => {
          if (s === 'active') return !t.completed;
          if (s === 'completed') return t.completed;
          if (s === 'overdue') return !t.completed && !!t.dueDate && new Date(t.dueDate) < this.today;
          return true;
        });
      });
    }
    if (f.priority?.length) list = list.filter((t) => f.priority!.includes(t.priority));
    if (f.categoryId?.length) list = list.filter((t) => t.categoryId && f.categoryId!.includes(t.categoryId));
    if (f.tagIds?.length) list = list.filter((t) => t.tags.some((tag) => f.tagIds!.includes(tag)));
    if (f.recurringOnly) list = list.filter((t) => !!t.recurrenceRule);
    if (f.hasReminder) list = list.filter((t) => !!t.reminder);
    if (f.dueDate === 'today') list = list.filter((t) => t.dueDate && this.sameDay(t.dueDate, this.today));
    if (f.dueDate === 'no-date') list = list.filter((t) => !t.dueDate);
    if (f.dueDate === 'this-week') {
      const s = startOfWeek(this.today);
      const e = endOfWeek(this.today);
      list = list.filter((t) => t.dueDate && new Date(t.dueDate) >= s && new Date(t.dueDate) <= e);
    }
    if (f.search) {
      const q = f.search.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description ?? '').toLowerCase().includes(q) ||
          (t.notes ?? '').toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)),
      );
    }

    return this.sortTasks(list, this.sortBy());
  });

  private sortTasks(list: Task[], key: SortKey): Task[] {
    const cmp: Record<SortKey, (a: Task, b: Task) => number> = {
      due: (a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'),
      priority: (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
      created: (a, b) => b.createdAt.localeCompare(a.createdAt),
      updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      alpha: (a, b) => a.title.localeCompare(b.title),
    };
    return list.sort(cmp[key]);
  }

  private sameDay(iso: string, d: Date): boolean {
    const x = new Date(iso);
    return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate();
  }

  private msg(err: unknown): string {
    return (err as NormalizedApiError)?.message ?? 'Something went wrong.';
  }

  loadTasks(params?: TaskQueryParams): void {
    this.loading.set(true);
    this.taskApi.getTasks(params).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.tasks.set(res.data.items);
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.show('error', this.msg(err));
      },
    });
  }

  /**
   * Optimistically inserts the task, fires the API call, and returns a stream that
   * emits the persisted task on success or errors with the NormalizedApiError on
   * failure (after rolling the optimistic item back). Callers that don't care about
   * the outcome can ignore the return value — the request still runs.
   */
  createTask(dto: CreateTaskRequest): Observable<Task> {
    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();
    const result$ = new ReplaySubject<Task>(1);
    const optimistic: Task = {
      id: tempId,
      userId: '',
      title: dto.title,
      description: dto.description ?? null,
      dueDate: dto.dueDate ?? null,
      dueTime: dto.dueTime ?? null,
      priority: dto.priority ?? 'Medium',
      categoryId: dto.categoryId ?? null,
      completed: false,
      completedAt: null,
      important: false,
      notes: dto.notes ?? null,
      tags: dto.tagNames ?? [],
      subtasks: [],
      reminder: null,
      recurrenceRule: null,
      history: [],
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.update((list) => [optimistic, ...list]);

    this.taskApi.createTask(dto).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const created = res.data;
          this.tasks.update((list) => list.map((t) => (t.id === tempId ? created : t)));
          this.toast.show('success', 'Task created');
          result$.next(created);
          result$.complete();
        } else {
          this.tasks.update((list) => list.filter((t) => t.id !== tempId));
          const message = res.message || 'Could not create the task.';
          this.toast.show('error', message);
          result$.error({ status: 0, message, errors: res.errors ?? [] } as NormalizedApiError);
        }
      },
      error: (err) => {
        this.tasks.update((list) => list.filter((t) => t.id !== tempId));
        this.toast.show('error', this.msg(err));
        result$.error(err);
      },
    });

    return result$.asObservable();
  }

  updateTask(id: string, dto: UpdateTaskRequest): void {
    const prev = this.tasks().find((t) => t.id === id);
    if (!prev) return;
    this.tasks.update((list) => list.map((t) => (t.id === id ? { ...t, ...dto } as Task : t)));

    this.taskApi.updateTask(id, dto).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.tasks.update((list) => list.map((t) => (t.id === id ? res.data! : t)));
        }
      },
      error: (err) => {
        this.tasks.update((list) => list.map((t) => (t.id === id ? prev : t)));
        this.toast.show('error', this.msg(err));
      },
    });
  }

  deleteTask(id: string): void {
    const prev = this.tasks();
    this.tasks.update((list) => list.filter((t) => t.id !== id));

    this.taskApi.deleteTask(id).subscribe({
      error: (err) => {
        this.tasks.set(prev);
        this.toast.show('error', this.msg(err));
      },
    });
  }

  toggleComplete(id: string): void {
    const prev = this.tasks().find((t) => t.id === id);
    if (!prev) return;
    const nextCompleted = !prev.completed;
    this.tasks.update((list) =>
      list.map((t) =>
        t.id === id
          ? { ...t, completed: nextCompleted, completedAt: nextCompleted ? new Date().toISOString() : null }
          : t,
      ),
    );

    const call = nextCompleted ? this.taskApi.completeTask(id) : this.taskApi.reopenTask(id);
    call.subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.tasks.update((list) => list.map((t) => (t.id === id ? res.data! : t)));
        }
      },
      error: (err) => {
        this.tasks.update((list) => list.map((t) => (t.id === id ? prev : t)));
        this.toast.show('error', this.msg(err));
      },
    });
  }

  toggleImportant(id: string): void {
    const prev = this.tasks().find((t) => t.id === id);
    if (!prev) return;
    this.tasks.update((list) =>
      list.map((t) => (t.id === id ? { ...t, important: !t.important } : t)),
    );

    this.taskApi.updateTask(id, { important: !prev.important }).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.tasks.update((list) => list.map((t) => (t.id === id ? res.data! : t)));
        }
      },
      error: (err) => {
        this.tasks.update((list) => list.map((t) => (t.id === id ? prev : t)));
        this.toast.show('error', this.msg(err));
      },
    });
  }

  setFilter(patch: Partial<FilterState>): void {
    this.filterState.update((f) => ({ ...f, ...patch }));
  }

  clearFilter(key: keyof FilterState): void {
    this.filterState.update((f) => {
      const next = { ...f };
      delete next[key];
      return next;
    });
  }

  upsertLocal(task: Task): void {
    this.tasks.update((list) => {
      const idx = list.findIndex((t) => t.id === task.id);
      if (idx === -1) return [task, ...list];
      const copy = [...list];
      copy[idx] = task;
      return copy;
    });
  }

  /** Convenience for "tomorrow" quick-add in calendar empty-day clicks. */
  tomorrowIso(): string {
    return addDays(this.today, 1).toISOString().split('T')[0];
  }
}
