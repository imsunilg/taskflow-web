import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AiApiService } from './ai-api.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ToastService } from '../../core/services/toast.service';
import { TaskStore } from '../../core/services/task.store';
import { UiStateService } from '../../core/services/ui-state.service';
import { NormalizedApiError } from '../../core/interceptors/error.interceptor';
import {
  AssistantTurn,
  ChatBubble,
  CreateTaskPreview,
  DailyPlan,
  DailySummary,
  GenericActionPreview,
  NextTaskRecommendation,
  NlSearchResult,
  ReschedulePreview,
} from '../../core/models/ai.model';

type SpeechRecognitionCtor = new () => any; // eslint-disable-line @typescript-eslint/no-explicit-any

const SUGGESTED_PROMPTS = [
  "What's due today?",
  'Show my overdue tasks',
  'Create a task to call the bank tomorrow at 5 PM',
  'Reschedule my overdue tasks to tomorrow',
  'high priority tasks due this week',
];

@Component({
  selector: 'tf-ai-assistant',
  standalone: true,
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="view ai-view">
      <div class="ai-view-head">
        <h1><tf-icon name="sparkle" [size]="22" /> TaskFlow AI</h1>
        <p class="view-subtitle">Ask in plain English — find tasks, create or reschedule them, or plan your day.</p>
      </div>

      <div class="view-actions" style="margin-bottom:12px">
        <button class="btn btn-outline btn-sm" type="button" (click)="runDailyPlan()" [disabled]="quickActionBusy()">
          <tf-icon name="sparkle" [size]="13" /> Plan my day
        </button>
        <button class="btn btn-outline btn-sm" type="button" (click)="runNextTask()" [disabled]="quickActionBusy()">
          <tf-icon name="flag" [size]="13" /> What should I do now?
        </button>
        <button class="btn btn-outline btn-sm" type="button" (click)="runDailySummary()" [disabled]="quickActionBusy()">
          <tf-icon name="clock" [size]="13" /> Today's summary
        </button>
      </div>

      <div class="ai-chat-frame">
        <div class="ai-chat-scroll" #scrollEl role="log" aria-live="polite" aria-label="Conversation with TaskFlow AI">
          @for (b of bubbles(); track b.id) {
            @if (b.role === 'user') {
              <div class="ai-msg-row user"><div class="ai-msg-bubble">{{ b.text }}</div></div>
            } @else {
              <div class="ai-msg-row assistant">
                <div class="ai-msg-bubble" [class.is-error]="b.error">{{ b.text }}</div>
                @if (b.error) {
                  <div class="ai-card-btns" style="margin-top:6px">
                    <button class="btn btn-outline btn-sm" type="button" (click)="retry(b)">Try Again</button>
                  </div>
                }
                @if (b.turn?.requiresConfirmation && b.status === 'pending') {
                  <div class="ai-msg-card">
                    @if (b.turn!.previewKind === 'create_task') {
                      <h4><tf-icon name="sparkle" [size]="13" /> Create Task</h4>
                      <div class="ai-preview-field-grid">
                        <div class="ai-preview-field" style="grid-column:1/-1">
                          <label>Title</label>
                          <input type="text" [value]="createPreview(b).task.title" (change)="onEditField(b, 'title', $event)" />
                        </div>
                        <div class="ai-preview-field">
                          <label>Due date</label>
                          <input type="date" [value]="createPreview(b).task.dueDate" (change)="onEditField(b, 'dueDate', $event)" />
                        </div>
                        <div class="ai-preview-field">
                          <label>Priority</label>
                          <select (change)="onEditField(b, 'priority', $event)">
                            @for (p of priorities; track p) {
                              <option [value]="p" [selected]="createPreview(b).task.priority === p">{{ p }}</option>
                            }
                          </select>
                        </div>
                      </div>
                      <div class="ai-card-btns">
                        <button class="btn btn-accent btn-sm" type="button" (click)="confirmBubble(b)" [disabled]="b.status !== 'pending'">Create Task</button>
                        <button class="btn btn-ghost btn-sm" type="button" (click)="cancelBubble(b)">Cancel</button>
                      </div>
                    } @else if (b.turn!.previewKind === 'reschedule') {
                      <h4><tf-icon name="sparkle" [size]="13" /> Changes</h4>
                      <div class="ai-diff-list">
                        @for (c of reschedulePreview(b).changes; track c.taskId) {
                          <div class="ai-diff-row">
                            <div class="task">{{ c.title }}</div>
                            <div class="change">{{ c.from }} → <b>{{ c.to }}</b></div>
                          </div>
                        }
                      </div>
                      <div class="ai-card-btns">
                        <button class="btn btn-accent btn-sm" type="button" (click)="confirmBubble(b)">Apply Changes</button>
                        <button class="btn btn-ghost btn-sm" type="button" (click)="cancelBubble(b)">Cancel</button>
                      </div>
                    } @else {
                      <h4><tf-icon name="sparkle" [size]="13" /> Confirm action</h4>
                      <p class="ai-analysis-note">{{ genericPreview(b).summary }}</p>
                      <div class="ai-card-btns">
                        <button class="btn btn-accent btn-sm" type="button" (click)="confirmBubble(b)">Confirm</button>
                        <button class="btn btn-ghost btn-sm" type="button" (click)="cancelBubble(b)">Cancel</button>
                      </div>
                    }
                  </div>
                }
                @if (b.turn?.results?.length) {
                  <div class="ai-msg-card">
                    <div class="ai-search-list">
                      @for (t of b.turn!.results; track t.id) {
                        <button type="button" class="rail-item" style="padding:6px 4px" (click)="openTask(t.id)">
                          <span class="rail-item-dot" [style.background]="'var(--p-' + t.priority.toLowerCase() + ')'"></span>
                          <span class="rail-item-title">{{ t.title }}</span>
                          <span class="rail-item-when">{{ t.dueDate || '' }}</span>
                        </button>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          }
          @if (loading()) {
            <div class="ai-msg-row assistant"><div class="ai-typing" aria-label="TaskFlow AI is thinking"><span></span><span></span><span></span></div></div>
          }
        </div>

        <div class="ai-suggest-row">
          @for (p of suggestedPrompts; track p) {
            <button type="button" class="ai-prompt-chip" (click)="send(p)">{{ p }}</button>
          }
        </div>

        <form class="ai-chat-input-row" (submit)="onSubmit($event)">
          <button
            type="button"
            class="ai-mic-btn"
            [class.is-recording]="recording()"
            (click)="toggleMic()"
            aria-label="Speak your message"
          >
            <tf-icon name="mic" [size]="17" />
          </button>
          <input #inputEl type="text" [(ngModel)]="draft" name="message" placeholder="Ask TaskFlow AI…" autocomplete="off" />
          <button type="submit" class="ai-send-btn" [disabled]="!draft.trim() || loading()" aria-label="Send message">
            <tf-icon name="send" [size]="15" />
          </button>
        </form>
      </div>
    </section>
  `,
})
export class AiAssistantComponent implements OnInit, OnDestroy {
  private readonly ai = inject(AiApiService);
  private readonly toast = inject(ToastService);
  private readonly store = inject(TaskStore);
  private readonly ui = inject(UiStateService);
  private readonly router = inject(Router);

  readonly priorities = ['Low', 'Medium', 'High', 'Urgent'] as const;
  readonly suggestedPrompts = SUGGESTED_PROMPTS;

  readonly bubbles = signal<ChatBubble[]>([
    { id: 'welcome', role: 'assistant', text: "Hi, I'm TaskFlow AI. Ask me to find, create, or reschedule tasks." },
  ]);
  readonly loading = signal(false);
  readonly quickActionBusy = signal(false);
  readonly recording = signal(false);
  draft = '';

  private readonly scrollEl = viewChild<ElementRef<HTMLElement>>('scrollEl');
  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');
  private recognition: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  ngOnInit(): void {
    queueMicrotask(() => this.inputEl()?.nativeElement.focus());
  }

  ngOnDestroy(): void {
    this.recognition?.stop?.();
  }

  private scrollToBottom(): void {
    queueMicrotask(() => {
      const el = this.scrollEl()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  private uid(): string {
    return 'b-' + Math.random().toString(36).slice(2, 9);
  }

  onSubmit(e: Event): void {
    e.preventDefault();
    const v = this.draft.trim();
    if (!v) return;
    this.draft = '';
    this.send(v);
  }

  send(message: string): void {
    this.bubbles.update((list) => [...list, { id: this.uid(), role: 'user', text: message }]);
    this.loading.set(true);
    this.scrollToBottom();

    this.ai.sendMessage(message).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.appendTurn(res.data);
        } else {
          this.appendError(res.message || 'Unable to process your request.', message);
        }
        this.scrollToBottom();
      },
      error: (err: NormalizedApiError) => {
        this.loading.set(false);
        this.appendError(err.message || 'Unable to process your request.', message);
        this.scrollToBottom();
      },
    });
  }

  private appendTurn(turn: AssistantTurn): void {
    this.bubbles.update((list) => [
      ...list,
      { id: this.uid(), role: 'assistant', text: turn.reply, turn, status: turn.requiresConfirmation ? 'pending' : undefined },
    ]);
  }

  private appendError(text: string, retryText: string): void {
    this.bubbles.update((list) => [
      ...list,
      { id: this.uid(), role: 'assistant', text, error: true, turn: { reply: retryText } as unknown as AssistantTurn },
    ]);
  }

  retry(bubble: ChatBubble): void {
    const text = (bubble.turn as unknown as { reply: string } | undefined)?.reply;
    if (text) this.send(text);
  }

  createPreview(b: ChatBubble): CreateTaskPreview {
    return b.turn!.preview as CreateTaskPreview;
  }
  reschedulePreview(b: ChatBubble): ReschedulePreview {
    return b.turn!.preview as ReschedulePreview;
  }
  genericPreview(b: ChatBubble): GenericActionPreview {
    return b.turn!.preview as GenericActionPreview;
  }

  onEditField(b: ChatBubble, field: 'title' | 'dueDate' | 'priority', e: Event): void {
    const value = (e.target as HTMLInputElement | HTMLSelectElement).value;
    if (!b.turn?.arguments) return;
    const key = field === 'title' ? 'title' : field === 'dueDate' ? 'dueDate' : 'priority';
    b.turn.arguments = { ...b.turn.arguments, [key]: value };
    const preview = this.createPreview(b);
    (preview.task as unknown as Record<string, string>)[field] = value;
    this.bubbles.update((list) => [...list]); // trigger re-render
  }

  confirmBubble(b: ChatBubble): void {
    if (!b.turn?.toolName || !b.turn.arguments) return;
    b.status = 'pending';
    this.ai.confirmAction(b.turn.toolName, b.turn.arguments).subscribe({
      next: (res) => {
        b.status = res.success ? 'confirmed' : 'cancelled';
        this.toast.show(res.success ? 'success' : 'error', res.message || (res.success ? 'Done.' : 'Could not apply that.'));
        if (res.success) {
          this.store.loadTasks(); // AI-confirmed changes are indistinguishable from manual ones — refresh the shared store
        }
        this.bubbles.update((list) => [...list]);
      },
      error: (err: NormalizedApiError) => {
        b.status = 'cancelled';
        this.toast.show('error', err.message || 'Could not apply that.');
        this.bubbles.update((list) => [...list]);
      },
    });
  }

  cancelBubble(b: ChatBubble): void {
    b.status = 'cancelled';
    this.bubbles.update((list) => [...list]);
  }

  openTask(id: string): void {
    this.ui.openTaskDetail(id);
  }

  // ---- quick-action cards (direct endpoints, not routed through chat NLU) ----

  runDailyPlan(): void {
    this.quickActionBusy.set(true);
    this.bubbles.update((list) => [...list, { id: this.uid(), role: 'assistant', text: "Here's today's AI plan:" }]);
    this.ai.generateDailyPlan().subscribe({
      next: (res) => {
        this.quickActionBusy.set(false);
        if (res.success && res.data) this.appendPlanCard(res.data);
        else this.toast.show('error', res.message || 'Could not generate a plan.');
        this.scrollToBottom();
      },
      error: (err: NormalizedApiError) => {
        this.quickActionBusy.set(false);
        this.toast.show('error', err.message || 'Could not generate a plan.');
      },
    });
  }

  runNextTask(): void {
    this.quickActionBusy.set(true);
    this.ai.nextTask().subscribe({
      next: (res) => {
        this.quickActionBusy.set(false);
        if (res.success && res.data) this.appendRecommendationCard(res.data);
        else this.bubbles.update((list) => [...list, { id: this.uid(), role: 'assistant', text: 'Nothing left to recommend right now.' }]);
        this.scrollToBottom();
      },
      error: (err: NormalizedApiError) => {
        this.quickActionBusy.set(false);
        this.toast.show('error', err.message || 'Could not get a recommendation.');
      },
    });
  }

  runDailySummary(): void {
    this.quickActionBusy.set(true);
    this.ai.dailySummary().subscribe({
      next: (res) => {
        this.quickActionBusy.set(false);
        if (res.success && res.data) this.appendSummaryCard(res.data);
        else this.toast.show('error', res.message || 'Could not summarize today.');
        this.scrollToBottom();
      },
      error: (err: NormalizedApiError) => {
        this.quickActionBusy.set(false);
        this.toast.show('error', err.message || 'Could not summarize today.');
      },
    });
  }

  private appendPlanCard(plan: DailyPlan): void {
    const lines = plan.blocks.length
      ? plan.blocks.map((b) => `${b.start.slice(0, 5)}–${b.end.slice(0, 5)} · ${b.title} (${b.priority})`).join('\n')
      : 'Nothing to schedule right now.';
    this.bubbles.update((list) => [...list, { id: this.uid(), role: 'assistant', text: lines }]);
  }

  private appendRecommendationCard(rec: NextTaskRecommendation): void {
    const text = `Recommended: ${rec.title}\n${rec.reasons.join(' · ')}\n${rec.suggestedAction}`;
    this.bubbles.update((list) => [...list, { id: this.uid(), role: 'assistant', text }]);
  }

  private appendSummaryCard(summary: DailySummary): void {
    const s = summary.stats;
    const text = `${s.completed} completed · ${s.remaining} remaining · ${s.overdue} overdue · ${s.completionRate}% done.\n${summary.insight}`;
    this.bubbles.update((list) => [...list, { id: this.uid(), role: 'assistant', text }]);
  }

  // ---- voice input into the chat box (live transcription where supported) ----

  toggleMic(): void {
    if (this.recording()) {
      this.recognition?.stop?.();
      this.recording.set(false);
      return;
    }
    const Ctor: SpeechRecognitionCtor | undefined =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition;
    if (!Ctor) {
      this.toast.show('info', "Voice input isn't supported in this browser — please type your message.");
      return;
    }
    try {
      this.recognition = new Ctor();
      this.recognition.lang = 'en-US';
      this.recognition.interimResults = true;
      this.recognition.continuous = true;
      this.recognition.onresult = (ev: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        let finalText = '';
        let interim = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        this.draft = (finalText || interim || this.draft).trim();
      };
      const stop = () => this.recording.set(false);
      this.recognition.onerror = stop;
      this.recognition.onend = stop;
      this.recognition.start();
      this.recording.set(true);
    } catch {
      this.toast.show('error', 'Could not start the microphone.');
    }
  }
}
