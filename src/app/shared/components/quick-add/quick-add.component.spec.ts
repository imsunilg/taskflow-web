import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { QuickAddComponent } from './quick-add.component';
import { TaskStore } from '../../../core/services/task.store';
import { UiStateService } from '../../../core/services/ui-state.service';
import { CategoryApiService } from '../../../features/categories/category-api.service';
import { Task } from '../../../core/models/task.model';

function createdTask(over: Partial<Task> = {}): Task {
  return {
    id: 'real-1', userId: 'u1', title: 'T', description: null, dueDate: null, dueTime: null,
    priority: 'Medium', categoryId: null, completed: false, completedAt: null, important: false,
    notes: null, tags: [], subtasks: [], reminder: null, recurrenceRule: null, history: [],
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...over,
  };
}

describe('QuickAddComponent', () => {
  const store = { createTask: vi.fn() };
  const ui = { closeQuickAdd: vi.fn(), quickAddDate: signal<string | null>(null) };
  const categoryApi = { getCategories: vi.fn() };

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [QuickAddComponent],
      providers: [
        { provide: TaskStore, useValue: store },
        { provide: UiStateService, useValue: ui },
        { provide: CategoryApiService, useValue: categoryApi },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(QuickAddComponent);
    fixture.detectChanges();
    return { fixture, cmp: fixture.componentInstance };
  }

  const ev = () => new Event('submit');

  beforeEach(() => {
    vi.restoreAllMocks();
    store.createTask.mockReset().mockReturnValue(of(createdTask()));
    ui.closeQuickAdd.mockReset();
    ui.quickAddDate.set(null);
    categoryApi.getCategories.mockReset().mockReturnValue(of({ data: [], success: true }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('saves a minimal task (title only) and closes the drawer', async () => {
    const { cmp } = await setup();
    cmp.form.controls.title.setValue('Buy milk');

    cmp.save(ev(), false);

    expect(store.createTask).toHaveBeenCalledTimes(1);
    expect(store.createTask.mock.calls[0][0]).toMatchObject({ title: 'Buy milk', description: null, dueDate: null, priority: 'Medium' });
    expect(ui.closeQuickAdd).toHaveBeenCalled();
  });

  it('maps every field to the API request shape', async () => {
    const { cmp } = await setup();
    cmp.form.patchValue({
      title: '  Ship it  ',
      description: 'the thing',
      dueDate: '2026-09-10',
      dueTime: '15:30',
      reminderOffsetMinutes: 30,
      recurrenceFrequency: 'Weekdays',
      priority: 'High',
      categoryId: 'cat-9',
      tags: '#api urgent',
      notes: 'context',
    });
    cmp.addRow();
    cmp.updateRow(1, 'step one');

    cmp.save(ev(), false);

    expect(store.createTask).toHaveBeenCalledWith({
      title: 'Ship it',
      description: 'the thing',
      dueDate: '2026-09-10',
      dueTime: '15:30',
      priority: 'High',
      categoryId: 'cat-9',
      reminderOffsetMinutes: 30,
      recurrenceFrequency: 'Weekdays',
      tagNames: ['api', 'urgent'],
      subtaskTexts: ['step one'],
      notes: 'context',
    });
  });

  it('blocks submit and shows an inline error when the title is empty', async () => {
    const { cmp } = await setup();

    cmp.save(ev(), false);

    expect(store.createTask).not.toHaveBeenCalled();
    expect(ui.closeQuickAdd).not.toHaveBeenCalled();
    expect(cmp.titleInvalid()).toBe(true);
  });

  it('drops a reminder that has no due date/time instead of sending an invalid payload', async () => {
    const { cmp } = await setup();
    cmp.form.patchValue({ title: 'x', reminderOffsetMinutes: 30 });

    cmp.save(ev(), false);

    // cross-field validator blocks it client-side
    expect(store.createTask).not.toHaveBeenCalled();
    expect(cmp.form.hasError('reminderNeedsDateTime')).toBe(true);
  });

  it('keeps the drawer open and preserves data + maps server errors on API failure', async () => {
    store.createTask.mockReturnValue(throwError(() => ({ status: 400, message: 'Validation failed.', errors: [{ field: 'Request.Title', message: 'Title is required.' }] })));
    const { cmp } = await setup();
    cmp.form.controls.title.setValue('Something');

    cmp.save(ev(), false);

    expect(ui.closeQuickAdd).not.toHaveBeenCalled();
    expect(cmp.form.controls.title.value).toBe('Something'); // data preserved
    expect(cmp.form.controls.title.errors?.['server']).toBe('Title is required.');
    expect(cmp.saving()).toBe(false);
  });

  it('shows a general banner when the server error is not field-specific', async () => {
    store.createTask.mockReturnValue(throwError(() => ({ status: 400, message: 'Validation failed.', errors: [{ field: 'Request', message: 'A reminder requires both a due date and a due time.' }] })));
    const { cmp } = await setup();
    cmp.form.controls.title.setValue('t');

    cmp.save(ev(), false);

    expect(cmp.serverError()).toContain('reminder requires');
  });

  it('Save & add another: creates one task, keeps the drawer open, resets after success', async () => {
    const gate = new Subject<Task>();
    store.createTask.mockReturnValue(gate);
    const { cmp } = await setup();
    cmp.form.patchValue({ title: 'First', categoryId: 'cat-1', notes: 'n' });

    cmp.save(ev(), true);
    expect(cmp.saving()).toBe(true);
    expect(cmp.form.controls.title.value).toBe('First'); // not reset yet

    gate.next(createdTask());
    gate.complete();

    expect(store.createTask).toHaveBeenCalledTimes(1);
    expect(ui.closeQuickAdd).not.toHaveBeenCalled();
    expect(cmp.form.controls.title.value).toBe(''); // cleared
    expect(cmp.form.controls.categoryId.value).toBe('cat-1'); // context preserved
    expect(cmp.form.controls.notes.value).toBe(''); // cleared
    expect(cmp.saving()).toBe(false);
  });

  it('ignores a second Save while the first request is in flight', async () => {
    const gate = new Subject<Task>();
    store.createTask.mockReturnValue(gate);
    const { cmp } = await setup();
    cmp.form.controls.title.setValue('Once');

    cmp.save(ev(), false);
    cmp.save(ev(), false);
    cmp.save(ev(), false);

    expect(store.createTask).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+Enter submits the form', async () => {
    const { cmp } = await setup();
    cmp.form.controls.title.setValue('Via keyboard');

    cmp.onCtrlEnter(new KeyboardEvent('keydown'));

    expect(store.createTask).toHaveBeenCalledTimes(1);
  });
});
