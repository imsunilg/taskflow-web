import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { TaskStore } from '../../../core/services/task.store';
import { UiStateService } from '../../../core/services/ui-state.service';
import { CategoryApiService } from '../../../features/categories/category-api.service';
import { TagApiService } from '../../../features/tags/tag-api.service';
import { Category } from '../../../core/models/category.model';
import { Tag } from '../../../core/models/tag.model';
import { FilterState, TaskStatus } from '../../../core/models/task.model';
import { PRIORITIES } from '../../utilities/priority.utils';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'tf-filter-panel',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="side-panel side-panel-narrow" role="dialog" aria-label="Filter tasks">
      <div class="side-panel-header">
        <h2>Filters</h2>
        <button class="icon-btn" type="button" (click)="ui.filterPanelOpen.set(false)" aria-label="Close">
          <tf-icon name="x" [size]="18" />
        </button>
      </div>

      <div class="side-panel-body">
        <div class="filter-group">
          <h4>Status</h4>
          @for (s of statuses; track s) {
            <label class="checkbox-row">
              <input type="checkbox" [checked]="draft().status?.includes(s)" (change)="toggleArr('status', s)" />
              <span>{{ s[0].toUpperCase() + s.slice(1) }}</span>
            </label>
          }
        </div>

        <div class="filter-group">
          <h4>Priority</h4>
          @for (p of priorities; track p) {
            <label class="checkbox-row">
              <input type="checkbox" [checked]="draft().priority?.includes(p)" (change)="toggleArr('priority', p)" />
              <span class="dot" [class]="'dot-' + p.toLowerCase()"></span><span>{{ p }}</span>
            </label>
          }
        </div>

        <div class="filter-group">
          <h4>Category</h4>
          @for (c of categories(); track c.id) {
            <label class="checkbox-row">
              <input
                type="checkbox"
                [checked]="draft().categoryId?.includes(c.id)"
                (change)="toggleArr('categoryId', c.id)"
              />
              <span class="category-dot" [style.background]="c.color"></span><span>{{ c.name }}</span>
            </label>
          } @empty { <span class="muted">No categories yet.</span> }
        </div>

        <div class="filter-group">
          <h4>Tags</h4>
          <div class="filter-tag-list">
            @for (t of tags(); track t.id) {
              <button
                type="button"
                class="filter-tag-chip"
                [class.is-active]="draft().tagIds?.includes(t.name)"
                (click)="toggleArr('tagIds', t.name)"
              >
                #{{ t.name }}
              </button>
            } @empty { <span class="muted">No tags yet.</span> }
          </div>
        </div>

        <div class="filter-group">
          <h4>Due date</h4>
          @for (d of dueBuckets; track d.value) {
            <label class="checkbox-row">
              <input
                type="radio"
                name="due"
                [checked]="draft().dueDate === d.value"
                (change)="setDue(d.value)"
              />
              <span>{{ d.label }}</span>
            </label>
          }
        </div>

        <div class="filter-group">
          <h4>Other</h4>
          <label class="checkbox-row">
            <input type="checkbox" [checked]="draft().recurringOnly" (change)="toggleBool('recurringOnly')" />
            <span>Recurring only</span>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" [checked]="draft().hasReminder" (change)="toggleBool('hasReminder')" />
            <span>Has reminder</span>
          </label>
        </div>
      </div>

      <div class="side-panel-footer">
        <button class="btn btn-ghost" type="button" (click)="clear()">Clear all</button>
        <button class="btn btn-accent" type="button" (click)="apply()">Apply filters</button>
      </div>
    </aside>
  `,
})
export class FilterPanelComponent implements OnInit {
  readonly store = inject(TaskStore);
  readonly ui = inject(UiStateService);
  private readonly categoryApi = inject(CategoryApiService);
  private readonly tagApi = inject(TagApiService);

  readonly categories = signal<Category[]>([]);
  readonly tags = signal<Tag[]>([]);
  readonly draft = signal<FilterState>({});

  readonly statuses: TaskStatus[] = ['active', 'completed', 'overdue'];
  readonly priorities = PRIORITIES;
  readonly dueBuckets = [
    { value: 'today' as const, label: 'Today' },
    { value: 'this-week' as const, label: 'This week' },
    { value: 'no-date' as const, label: 'No due date' },
  ];

  ngOnInit(): void {
    this.draft.set({ ...this.store.filterState() });
    this.categoryApi.getCategories().subscribe({ next: (r) => r.data && this.categories.set(r.data) });
    this.tagApi.getTags().subscribe({ next: (r) => r.data && this.tags.set(r.data) });
  }

  toggleArr(key: 'status' | 'priority' | 'categoryId' | 'tagIds', value: string): void {
    this.draft.update((d) => {
      const current = ((d[key] as string[]) ?? []).slice();
      const idx = current.indexOf(value);
      if (idx === -1) current.push(value);
      else current.splice(idx, 1);
      return { ...d, [key]: current.length ? (current as never) : undefined };
    });
  }

  toggleBool(key: 'recurringOnly' | 'hasReminder'): void {
    this.draft.update((d) => ({ ...d, [key]: !d[key] || undefined }));
  }

  setDue(value: FilterState['dueDate']): void {
    this.draft.update((d) => ({ ...d, dueDate: d.dueDate === value ? undefined : value }));
  }

  clear(): void {
    this.draft.set({});
  }

  apply(): void {
    this.store.filterState.set({ ...this.draft(), search: this.store.filterState().search });
    this.ui.filterPanelOpen.set(false);
  }
}
