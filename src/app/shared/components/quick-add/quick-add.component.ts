import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TaskStore } from '../../../core/services/task.store';
import { UiStateService } from '../../../core/services/ui-state.service';
import { CategoryApiService } from '../../../features/categories/category-api.service';
import { NormalizedApiError } from '../../../core/interceptors/error.interceptor';
import { Category } from '../../../core/models/category.model';
import { Priority } from '../../../core/models/task.model';
import { PriorityPickerComponent } from '../priority-picker/priority-picker.component';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'tf-quick-add',
  standalone: true,
  imports: [ReactiveFormsModule, PriorityPickerComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.control.enter)': 'onCtrlEnter($event)' },
  template: `
    <aside class="side-panel" role="dialog" aria-label="New task" aria-modal="true">
      <form class="side-panel-form" [formGroup]="form" (ngSubmit)="save($event, false)">
        <div class="side-panel-header">
          <h2>New task</h2>
          <button class="icon-btn" type="button" (click)="requestClose()" aria-label="Close">
            <tf-icon name="x" [size]="18" />
          </button>
        </div>

        <div class="side-panel-body">
          @if (serverError()) {
            <div class="form-server-error" role="alert">{{ serverError() }}</div>
          }

          <div class="field">
            <label for="qa-title">Title <span class="req" aria-hidden="true">*</span></label>
            <input
              #titleInput
              id="qa-title"
              class="field-title-input"
              type="text"
              formControlName="title"
              placeholder="e.g. Send the sprint report"
              autocomplete="off"
              [attr.aria-invalid]="titleInvalid() ? 'true' : null"
              aria-describedby="qa-title-error"
            />
            @if (titleInvalid()) {
              <div id="qa-title-error" class="field-error">A title is required.</div>
            }
          </div>

          <div class="field">
            <label for="qa-desc">Description</label>
            <textarea id="qa-desc" formControlName="description" rows="2" placeholder="Add a description…"></textarea>
          </div>

          <div class="field-row">
            <div class="field">
              <label for="qa-date">Due date</label>
              <input id="qa-date" type="date" formControlName="dueDate" />
            </div>
            <div class="field">
              <label for="qa-time">Due time</label>
              <input id="qa-time" type="time" formControlName="dueTime" />
            </div>
          </div>
          @if (form.hasError('timeNeedsDate')) {
            <div class="field-error">Pick a due date as well to set a time.</div>
          }

          <div class="field-row">
            <div class="field">
              <label for="qa-reminder">Reminder</label>
              <select id="qa-reminder" formControlName="reminderOffsetMinutes">
                <option [ngValue]="null">No reminder</option>
                <option [ngValue]="0">At due time</option>
                <option [ngValue]="5">5 minutes before</option>
                <option [ngValue]="10">10 minutes before</option>
                <option [ngValue]="15">15 minutes before</option>
                <option [ngValue]="30">30 minutes before</option>
                <option [ngValue]="60">1 hour before</option>
                <option [ngValue]="1440">1 day before</option>
              </select>
            </div>
            <div class="field">
              <label for="qa-repeat">Repeat</label>
              <select id="qa-repeat" formControlName="recurrenceFrequency">
                <option [ngValue]="null">Does not repeat</option>
                <option value="Daily">Daily</option>
                <option value="Weekdays">Weekdays</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
                <option value="Yearly">Yearly</option>
              </select>
            </div>
          </div>
          @if (form.hasError('reminderNeedsDateTime')) {
            <div class="field-error">A reminder needs both a due date and a due time.</div>
          }

          <div class="field">
            <label class="field-label">Priority</label>
            <tf-priority-picker
              [value]="form.controls.priority.value"
              (valueChange)="form.controls.priority.setValue($event)"
            />
          </div>

          <div class="field-row">
            <div class="field">
              <label for="qa-category">Category</label>
              <select id="qa-category" formControlName="categoryId">
                <option [ngValue]="null">No category</option>
                @for (c of categories(); track c.id) {
                  <option [ngValue]="c.id">{{ c.name }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label for="qa-tags">Tags</label>
              <input id="qa-tags" type="text" formControlName="tags" placeholder="#api #urgent" />
            </div>
          </div>

          <div class="field">
            <label class="field-label">Subtasks</label>
            <div class="subtask-editor">
              @for (row of subtaskRows(); track row.id) {
                <div class="subtask-edit-row">
                  <input
                    type="text"
                    [value]="row.text"
                    (input)="updateRow(row.id, $any($event.target).value)"
                    placeholder="Subtask…"
                  />
                  <button type="button" class="subtask-remove" (click)="removeRow(row.id)" aria-label="Remove subtask">×</button>
                </div>
              }
            </div>
            <button type="button" class="text-btn" (click)="addRow()">+ Add subtask</button>
          </div>

          <div class="field">
            <label for="qa-notes">Notes</label>
            <textarea id="qa-notes" formControlName="notes" rows="2" placeholder="Any extra context…"></textarea>
          </div>
        </div>

        <div class="side-panel-footer">
          <button type="button" class="btn btn-ghost" (click)="requestClose()" [disabled]="saving()">Cancel</button>
          <button type="button" class="btn btn-outline" (click)="save($event, true)" [disabled]="saving()">
            {{ saving() ? 'Saving…' : 'Save & add another' }}
          </button>
          <button type="submit" class="btn btn-accent" [disabled]="saving()">
            {{ saving() ? 'Saving…' : 'Save task' }}
          </button>
        </div>
      </form>
    </aside>
  `,
})
export class QuickAddComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly store = inject(TaskStore);
  readonly ui = inject(UiStateService);
  private readonly categoryApi = inject(CategoryApiService);

  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');

  readonly categories = signal<Category[]>([]);
  readonly subtaskRows = signal<{ id: number; text: string }[]>([]);
  readonly showErrors = signal(false);
  readonly saving = signal(false);
  readonly serverError = signal<string | null>(null);
  private nextRow = 1;

  readonly form = this.fb.nonNullable.group(
    {
      title: ['', [Validators.required, Validators.maxLength(500)]],
      description: [''],
      dueDate: [''],
      dueTime: [''],
      reminderOffsetMinutes: this.fb.control<number | null>(null),
      recurrenceFrequency: this.fb.control<string | null>(null),
      priority: this.fb.nonNullable.control<Priority>('Medium'),
      categoryId: this.fb.control<string | null>(null),
      tags: [''],
      notes: [''],
    },
    { validators: [crossFieldValidator] },
  );

  titleInvalid(): boolean {
    const c = this.form.controls.title;
    return (this.showErrors() || c.touched) && c.invalid;
  }

  constructor() {
    effect(() => {
      const date = this.ui.quickAddDate();
      if (date) this.form.controls.dueDate.setValue(date);
    });
  }

  ngOnInit(): void {
    this.categoryApi.getCategories().subscribe({ next: (r) => r.data && this.categories.set(r.data) });
    queueMicrotask(() => this.titleInput()?.nativeElement.focus());
  }

  addRow(): void {
    this.subtaskRows.update((r) => [...r, { id: this.nextRow++, text: '' }]);
  }
  updateRow(id: number, text: string): void {
    this.subtaskRows.update((r) => r.map((x) => (x.id === id ? { ...x, text } : x)));
  }
  removeRow(id: number): void {
    this.subtaskRows.update((r) => r.filter((x) => x.id !== id));
  }

  onCtrlEnter(e: Event): void {
    this.save(e, false);
  }

  private hasContent(): boolean {
    return this.form.dirty || this.subtaskRows().some((r) => r.text.trim());
  }

  requestClose(): void {
    if (this.saving()) return;
    if (this.hasContent() && !confirm('Discard this task? Your entered details will be lost.')) return;
    this.ui.closeQuickAdd();
  }

  save(e: Event, addAnother: boolean): void {
    e.preventDefault();
    e.stopPropagation();
    if (this.saving()) return; // block double-submit

    this.serverError.set(null);
    this.form.markAllAsTouched();
    this.form.updateValueAndValidity();

    if (this.form.invalid) {
      this.showErrors.set(true);
      this.focusFirstError();
      return;
    }

    const v = this.form.getRawValue();
    const hasDate = !!v.dueDate;
    const hasTime = !!v.dueTime;

    this.saving.set(true);
    this.store
      .createTask({
        title: v.title.trim(),
        description: v.description.trim() || null,
        dueDate: v.dueDate || null,
        dueTime: (hasDate && v.dueTime) || null,
        priority: v.priority,
        categoryId: v.categoryId,
        reminderOffsetMinutes: hasDate && hasTime ? v.reminderOffsetMinutes : null,
        recurrenceFrequency: (v.recurrenceFrequency as never) || null,
        tagNames: v.tags
          ? v.tags
              .split(/[\s,]+/)
              .map((t) => t.replace(/^#/, '').trim())
              .filter(Boolean)
          : [],
        subtaskTexts: this.subtaskRows()
          .map((r) => r.text.trim())
          .filter(Boolean),
        notes: v.notes.trim() || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          if (addAnother) {
            this.resetForNext(v.categoryId, v.dueDate);
          } else {
            this.ui.closeQuickAdd();
          }
        },
        error: (err: NormalizedApiError) => {
          this.saving.set(false);
          this.applyServerErrors(err);
        },
      });
  }

  /** Reset for the next entry, keeping the useful context (category + date). */
  private resetForNext(categoryId: string | null, dueDate: string): void {
    this.form.reset({
      priority: 'Medium',
      reminderOffsetMinutes: null,
      recurrenceFrequency: null,
      categoryId,
      dueDate,
    });
    this.subtaskRows.set([]);
    this.showErrors.set(false);
    this.serverError.set(null);
    queueMicrotask(() => this.titleInput()?.nativeElement.focus());
  }

  private applyServerErrors(err: NormalizedApiError): void {
    const errors = Array.isArray(err?.errors) ? err.errors : [];
    const unmapped: string[] = [];

    for (const item of errors) {
      const control = this.controlFor(item.field);
      if (control) {
        control.setErrors({ ...(control.errors ?? {}), server: item.message });
        control.markAsTouched();
      } else {
        unmapped.push(item.message);
      }
    }

    this.showErrors.set(true);
    // Field-less errors (e.g. cross-field rules) become a banner.
    const bannerParts = unmapped.length ? unmapped : errors.length ? [] : [err?.message].filter(Boolean);
    this.serverError.set(
      bannerParts.length
        ? bannerParts.join(' ')
        : errors.length
          ? null
          : 'The task could not be saved. Please try again.',
    );
    this.focusFirstError();
  }

  private controlFor(field: string): AbstractControl | null {
    const key = (field ?? '').split('.').pop()?.replace(/^[A-Z]/, (m) => m.toLowerCase()) ?? '';
    const map: Record<string, keyof typeof this.form.controls> = {
      title: 'title',
      description: 'description',
      duedate: 'dueDate',
      duetime: 'dueTime',
      reminderoffsetminutes: 'reminderOffsetMinutes',
      recurrencefrequency: 'recurrenceFrequency',
      notes: 'notes',
    };
    const ctrlName = map[key.toLowerCase()];
    return ctrlName ? this.form.controls[ctrlName] : null;
  }

  private focusFirstError(): void {
    if (this.form.controls.title.invalid) {
      const el = this.titleInput()?.nativeElement;
      el?.focus?.();
      el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    }
  }
}

/**
 * Group-level validator mirroring the backend rules so the user sees them before
 * the request is sent. Returns only group errors — it never mutates child controls
 * (doing so from a parent validator recurses).
 */
function crossFieldValidator(group: AbstractControl): Record<string, boolean> | null {
  const date = group.get('dueDate')?.value;
  const time = group.get('dueTime')?.value;
  const reminder = group.get('reminderOffsetMinutes')?.value;

  const errors: Record<string, boolean> = {};
  if (time && !date) errors['timeNeedsDate'] = true;
  if (reminder !== null && reminder !== undefined && (!date || !time)) errors['reminderNeedsDateTime'] = true;

  return Object.keys(errors).length ? errors : null;
}
