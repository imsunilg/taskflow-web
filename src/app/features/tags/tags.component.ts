import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TagApiService } from './tag-api.service';
import { Tag } from '../../core/models/tag.model';
import { ToastService } from '../../core/services/toast.service';
import { TaskStore } from '../../core/services/task.store';

@Component({
  selector: 'tf-tags',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="view">
      <header class="view-header">
        <div>
          <h1 class="view-title">Tags</h1>
          <p class="view-subtitle">Cross-cutting labels you can attach to any task</p>
        </div>
      </header>

      <form class="inline-add-form" (submit)="add($event)">
        <input type="text" [(ngModel)]="name" name="name" placeholder="New tag name" required />
        <button class="btn btn-accent btn-sm" type="submit">Add tag</button>
      </form>

      @if (tags().length) {
        <div class="tag-cloud">
          @for (t of tags(); track t.id) {
            <span class="tag-cloud-item">
              #{{ t.name }}
              <span class="tag-cloud-count">{{ count(t.name) }}</span>
              <button class="tag-cloud-del" type="button" (click)="remove(t)" [attr.aria-label]="'Delete tag ' + t.name">×</button>
            </span>
          }
        </div>
      } @else {
        <div class="empty-state">
          <div class="empty-illustration">#</div>
          <h3>No tags yet</h3>
          <p>Add a tag above, then attach it to tasks from Quick Add or the detail drawer.</p>
        </div>
      }
    </section>
  `,
})
export class TagsComponent implements OnInit {
  private readonly api = inject(TagApiService);
  private readonly toast = inject(ToastService);
  private readonly store = inject(TaskStore);

  readonly tags = signal<Tag[]>([]);
  name = '';

  ngOnInit(): void {
    this.api.getTags().subscribe({ next: (r) => r.data && this.tags.set(r.data) });
    this.store.loadTasks();
  }

  count(tag: string): number {
    return this.store.activeTasks().filter((t) => t.tags.includes(tag)).length;
  }

  add(e: Event): void {
    e.preventDefault();
    if (!this.name.trim()) return;
    this.api.createTag({ name: this.name.trim() }).subscribe({
      next: (r) => {
        if (r.data) this.tags.update((l) => [...l, r.data!]);
        this.name = '';
        this.toast.show('success', 'Tag created');
      },
      error: (err) => this.toast.show('error', err.message),
    });
  }

  remove(t: Tag): void {
    this.api.deleteTag(t.id).subscribe({
      next: () => {
        this.tags.update((l) => l.filter((x) => x.id !== t.id));
        this.toast.show('success', 'Tag deleted');
      },
      error: (err) => this.toast.show('error', err.message),
    });
  }
}
