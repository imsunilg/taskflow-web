import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AiAssistantComponent } from './ai-assistant.component';
import { AiApiService } from './ai-api.service';
import { ToastService } from '../../core/services/toast.service';
import { TaskStore } from '../../core/services/task.store';
import { UiStateService } from '../../core/services/ui-state.service';
import { AssistantTurn } from '../../core/models/ai.model';

describe('AiAssistantComponent', () => {
  const ai = {
    sendMessage: vi.fn(),
    confirmAction: vi.fn(),
    generateDailyPlan: vi.fn(),
    nextTask: vi.fn(),
    dailySummary: vi.fn(),
  };
  const toast = { show: vi.fn() };
  const store = { loadTasks: vi.fn() };
  const ui = { openTaskDetail: vi.fn() };

  async function mount() {
    await TestBed.configureTestingModule({
      imports: [AiAssistantComponent],
      providers: [
        { provide: AiApiService, useValue: ai },
        { provide: ToastService, useValue: toast },
        { provide: TaskStore, useValue: store },
        { provide: UiStateService, useValue: ui },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AiAssistantComponent);
    fixture.detectChanges();
    return { fixture, cmp: fixture.componentInstance };
  }

  beforeEach(() => {
    Object.values(ai).forEach((fn) => fn.mockReset());
    toast.show.mockReset();
    store.loadTasks.mockReset();
    ui.openTaskDetail.mockReset();
  });

  it('starts with a welcome bubble and no pending confirmation', async () => {
    const { cmp } = await mount();
    expect(cmp.bubbles().length).toBe(1);
    expect(cmp.bubbles()[0].role).toBe('assistant');
  });

  it('sending a plain-text message appends the reply and never requires confirmation', async () => {
    const turn: AssistantTurn = {
      reply: "You have 2 tasks due today.",
      toolName: null,
      arguments: null,
      requiresConfirmation: false,
      previewKind: null,
      preview: null,
      results: null,
    };
    ai.sendMessage.mockReturnValue(of({ success: true, message: '', data: turn, errors: [], pagination: null }));

    const { cmp } = await mount();
    cmp.send('what is due today?');

    expect(ai.sendMessage).toHaveBeenCalledWith('what is due today?');
    expect(cmp.loading()).toBe(false);
    const last = cmp.bubbles().at(-1)!;
    expect(last.text).toBe(turn.reply);
    expect(last.status).toBeUndefined();
  });

  it('a create_task preview renders as pending and is never applied until confirmed', async () => {
    const turn: AssistantTurn = {
      reply: "Here's what I understood — review before I create it.",
      toolName: 'CreateTask',
      arguments: { title: 'Buy milk' },
      requiresConfirmation: true,
      previewKind: 'create_task',
      preview: { task: { title: 'Buy milk', description: null, dueDate: null, dueTime: null, priority: 'Medium', category: null, tags: [] } },
      results: null,
    };
    ai.sendMessage.mockReturnValue(of({ success: true, message: '', data: turn, errors: [], pagination: null }));

    const { cmp } = await mount();
    cmp.send('create task Buy milk');

    const bubble = cmp.bubbles().at(-1)!;
    expect(bubble.status).toBe('pending');
    expect(ai.confirmAction).not.toHaveBeenCalled();
  });

  it('confirming a pending action calls confirmAction with the exact tool + args shown, then refreshes the task store', async () => {
    const turn: AssistantTurn = {
      reply: 'preview',
      toolName: 'CreateTask',
      arguments: { title: 'Buy milk' },
      requiresConfirmation: true,
      previewKind: 'create_task',
      preview: { task: { title: 'Buy milk', description: null, dueDate: null, dueTime: null, priority: 'Medium', category: null, tags: [] } },
      results: null,
    };
    ai.sendMessage.mockReturnValue(of({ success: true, message: '', data: turn, errors: [], pagination: null }));
    ai.confirmAction.mockReturnValue(of({ success: true, message: 'Task created successfully with AI.', data: turn, errors: [], pagination: null }));

    const { cmp } = await mount();
    cmp.send('create task Buy milk');
    const bubble = cmp.bubbles().at(-1)!;

    cmp.confirmBubble(bubble);

    expect(ai.confirmAction).toHaveBeenCalledWith('CreateTask', { title: 'Buy milk' });
    expect(bubble.status).toBe('confirmed');
    expect(store.loadTasks).toHaveBeenCalled();
    expect(toast.show).toHaveBeenCalledWith('success', 'Task created successfully with AI.');
  });

  it('cancelling a pending action never calls confirmAction', async () => {
    const turn: AssistantTurn = {
      reply: 'preview',
      toolName: 'DeleteTask',
      arguments: { titleQuery: 'old task' },
      requiresConfirmation: true,
      previewKind: 'generic',
      preview: { toolName: 'DeleteTask', summary: 'Delete "old task"' },
      results: null,
    };
    ai.sendMessage.mockReturnValue(of({ success: true, message: '', data: turn, errors: [], pagination: null }));

    const { cmp } = await mount();
    cmp.send('delete old task');
    const bubble = cmp.bubbles().at(-1)!;

    cmp.cancelBubble(bubble);

    expect(bubble.status).toBe('cancelled');
    expect(ai.confirmAction).not.toHaveBeenCalled();
  });

  it('a failed send renders an error bubble with a retry action', async () => {
    ai.sendMessage.mockReturnValue(of({ success: false, message: 'Unable to process your request.', data: null, errors: [], pagination: null }));

    const { cmp } = await mount();
    cmp.send('do something odd');

    const bubble = cmp.bubbles().at(-1)!;
    expect(bubble.error).toBe(true);
    expect(bubble.text).toBe('Unable to process your request.');
  });
});
