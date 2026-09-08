import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TaskStore } from './task.store';
import { ToastService } from './toast.service';
import { TaskApiService } from '../../features/tasks/task-api.service';
import { ApiResponse, PagedResult } from '../models/api.models';
import { Task } from '../models/task.model';

function task(over: Partial<Task> = {}): Task {
  return {
    id: 't1', userId: 'u1', title: 'Seed', description: null, dueDate: null, dueTime: null,
    priority: 'Medium', categoryId: null, completed: false, completedAt: null, important: false,
    notes: null, tags: [], subtasks: [], reminder: null, recurrenceRule: null, history: [],
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...over,
  };
}
const ok = <T>(data: T): ApiResponse<T> => ({ success: true, message: '', data, errors: [], pagination: null });

describe('TaskStore', () => {
  let api: {
    getTasks: ReturnType<typeof vi.fn>;
    createTask: ReturnType<typeof vi.fn>;
    completeTask: ReturnType<typeof vi.fn>;
    reopenTask: ReturnType<typeof vi.fn>;
  };
  let store: TaskStore;
  const toast = { show: vi.fn() };

  beforeEach(() => {
    api = {
      getTasks: vi.fn(),
      createTask: vi.fn(),
      completeTask: vi.fn(),
      reopenTask: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        TaskStore,
        { provide: TaskApiService, useValue: api },
        { provide: ToastService, useValue: toast },
      ],
    });
    store = TestBed.inject(TaskStore);
    toast.show.mockClear();
  });

  it('loadTasks fills the tasks signal on success', () => {
    const paged: PagedResult<Task> = { items: [task({ id: 'a' }), task({ id: 'b' })], page: 1, pageSize: 25, total: 2, totalPages: 1 };
    api.getTasks.mockReturnValue(of(ok(paged)));

    store.loadTasks();

    expect(store.tasks().map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('createTask adds a temp item then replaces it with the server response and emits it', () => {
    api.createTask.mockReturnValue(of(ok(task({ id: 'real-1', title: 'Done' }))));
    let emitted: Task | undefined;

    store.createTask({ title: 'Done' }).subscribe((t) => (emitted = t));

    expect(store.tasks()).toHaveLength(1);
    expect(store.tasks()[0].id).toBe('real-1');
    expect(emitted?.id).toBe('real-1');
    expect(toast.show).toHaveBeenCalledWith('success', 'Task created');
  });

  it('createTask removes the temp item, toasts, and errors the stream on API failure', () => {
    api.createTask.mockReturnValue(throwError(() => ({ status: 400, message: 'boom', errors: [] })));
    let errored: unknown;

    store.createTask({ title: 'X' }).subscribe({ error: (e) => (errored = e) });

    expect(store.tasks()).toHaveLength(0);
    expect(toast.show).toHaveBeenCalledWith('error', 'boom');
    expect((errored as { message: string }).message).toBe('boom');
  });

  it('toggleComplete flips locally and reverts on API error', () => {
    store.tasks.set([task({ id: 't1', completed: false })]);
    api.completeTask.mockReturnValue(throwError(() => ({ message: 'nope' })));

    store.toggleComplete('t1');

    expect(store.tasks()[0].completed).toBe(false);
    expect(toast.show).toHaveBeenCalledWith('error', 'nope');
  });
});
