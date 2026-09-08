import { ComponentRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import axe from 'axe-core';
import { TaskCardComponent } from '../shared/components/task-card/task-card.component';
import { PriorityPickerComponent } from '../shared/components/priority-picker/priority-picker.component';
import { SubtaskRowComponent } from '../shared/components/subtask-row/subtask-row.component';
import { Task } from '../core/models/task.model';

async function analyze(el: HTMLElement) {
  document.body.appendChild(el);
  const results = await axe.run(el, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    // color-contrast needs a real canvas; not meaningful under jsdom.
    rules: { 'color-contrast': { enabled: false } },
  });
  document.body.removeChild(el);
  return results.violations;
}

const task: Task = {
  id: 't1', userId: 'u1', title: 'Accessible task', description: null, dueDate: '2026-02-01',
  dueTime: '09:00', priority: 'High', categoryId: null, categoryName: 'Work', categoryColor: '#3b82f6',
  completed: false, completedAt: null, important: false, notes: null, tags: ['x'],
  subtasks: [{ id: 's1', taskId: 't1', text: 'step', isDone: false, sortOrder: 0 }],
  reminder: null, recurrenceRule: null, history: [],
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
};

describe('accessibility (axe-core, WCAG 2 AA)', () => {
  it('TaskCardComponent has no violations', async () => {
    await TestBed.configureTestingModule({ imports: [TaskCardComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TaskCardComponent);
    (fixture.componentRef as ComponentRef<TaskCardComponent>).setInput('task', task);
    fixture.detectChanges();
    expect(await analyze(fixture.nativeElement)).toEqual([]);
  });

  it('PriorityPickerComponent has no violations', async () => {
    await TestBed.configureTestingModule({ imports: [PriorityPickerComponent] }).compileComponents();
    const fixture = TestBed.createComponent(PriorityPickerComponent);
    fixture.detectChanges();
    expect(await analyze(fixture.nativeElement)).toEqual([]);
  });

  it('SubtaskRowComponent has no violations', async () => {
    await TestBed.configureTestingModule({ imports: [SubtaskRowComponent] }).compileComponents();
    const fixture = TestBed.createComponent(SubtaskRowComponent);
    (fixture.componentRef as ComponentRef<SubtaskRowComponent>).setInput('subtask', task.subtasks[0]);
    fixture.detectChanges();
    expect(await analyze(fixture.nativeElement)).toEqual([]);
  });
});
