import { ComponentRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TaskCardComponent } from './task-card.component';
import { Task } from '../../../core/models/task.model';

function makeTask(over: Partial<Task> = {}): Task {
  return {
    id: 't1', userId: 'u1', title: 'Write the report', description: null,
    dueDate: null, dueTime: null, priority: 'High', categoryId: null,
    completed: false, completedAt: null, important: false, notes: null,
    tags: [], subtasks: [], reminder: null, recurrenceRule: null, history: [],
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

describe('TaskCardComponent', () => {
  async function setup(task: Task) {
    await TestBed.configureTestingModule({ imports: [TaskCardComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TaskCardComponent);
    (fixture.componentRef as ComponentRef<TaskCardComponent>).setInput('task', task);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the task title', async () => {
    const fixture = await setup(makeTask());
    expect(fixture.nativeElement.textContent).toContain('Write the report');
  });

  it('exposes the priority colour on the card', async () => {
    const fixture = await setup(makeTask({ priority: 'Urgent' }));
    const card = fixture.nativeElement.querySelector('.task-card') as HTMLElement;
    expect(card.style.getPropertyValue('--priority-color')).toBeTruthy();
  });

  it('emits toggleComplete when the checkbox is clicked', async () => {
    const fixture = await setup(makeTask());
    let emitted: string | undefined;
    fixture.componentInstance.toggleComplete.subscribe((id) => (emitted = id));
    (fixture.nativeElement.querySelector('.task-checkbox') as HTMLButtonElement).click();
    expect(emitted).toBe('t1');
  });

  it('emits open when the card body is clicked', async () => {
    const fixture = await setup(makeTask());
    let opened: string | undefined;
    fixture.componentInstance.open.subscribe((id) => (opened = id));
    (fixture.nativeElement.querySelector('.task-body') as HTMLButtonElement).click();
    expect(opened).toBe('t1');
  });

  it('shows a subtask progress bar when subtasks exist', async () => {
    const fixture = await setup(makeTask({
      subtasks: [
        { id: 's1', taskId: 't1', text: 'a', isDone: true, sortOrder: 0 },
        { id: 's2', taskId: 't1', text: 'b', isDone: false, sortOrder: 1 },
      ],
    }));
    expect(fixture.nativeElement.querySelector('.subtask-progress-wrap')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('1/2');
  });
});
