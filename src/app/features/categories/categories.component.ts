import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CategoryApiService } from './category-api.service';
import { Category } from '../../core/models/category.model';
import { ToastService } from '../../core/services/toast.service';
import { TaskStore } from '../../core/services/task.store';

@Component({
  selector: 'tf-categories',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="view">
      <header class="view-header">
        <div>
          <h1 class="view-title">Categories</h1>
          <p class="view-subtitle">Organize tasks into custom areas of your life and work</p>
        </div>
      </header>

      <form class="inline-add-form" (submit)="add($event)">
        <input type="text" [(ngModel)]="name" name="name" placeholder="New category name" required />
        <input type="color" [(ngModel)]="color" name="color" aria-label="Category colour" />
        <button class="btn btn-accent btn-sm" type="submit">Add category</button>
      </form>

      @if (categories().length) {
        <div class="category-grid">
          @for (c of categories(); track c.id) {
            <div
              class="category-card"
              [style.--cat-color]="c.color"
              [style.--cat-tint]="'color-mix(in srgb, ' + c.color + ' 16%, transparent)'"
            >
              <button class="category-card-del" type="button" (click)="remove(c)" [attr.aria-label]="'Delete ' + c.name">×</button>
              <div class="category-card-icon">{{ c.name[0].toUpperCase() }}</div>
              <div class="category-card-name">{{ c.name }}</div>
              <div class="category-card-count">{{ count(c.id) }} task{{ count(c.id) === 1 ? '' : 's' }}</div>
            </div>
          }
        </div>
      } @else {
        <div class="empty-state">
          <div class="empty-illustration">▦</div>
          <h3>No categories yet</h3>
          <p>Create your first category above to start grouping tasks.</p>
        </div>
      }
    </section>
  `,
})
export class CategoriesComponent implements OnInit {
  private readonly api = inject(CategoryApiService);
  private readonly toast = inject(ToastService);
  private readonly store = inject(TaskStore);

  readonly categories = signal<Category[]>([]);
  name = '';
  color = '#5b93e8';

  ngOnInit(): void {
    this.api.getCategories().subscribe({ next: (r) => r.data && this.categories.set(r.data) });
    this.store.loadTasks();
  }

  count(id: string): number {
    return this.store.activeTasks().filter((t) => t.categoryId === id).length;
  }

  add(e: Event): void {
    e.preventDefault();
    if (!this.name.trim()) return;
    this.api.createCategory({ name: this.name.trim(), color: this.color }).subscribe({
      next: (r) => {
        if (r.data) this.categories.update((l) => [...l, r.data!]);
        this.name = '';
        this.toast.show('success', 'Category created');
      },
      error: (err) => this.toast.show('error', err.message),
    });
  }

  remove(c: Category): void {
    this.api.deleteCategory(c.id).subscribe({
      next: () => {
        this.categories.update((l) => l.filter((x) => x.id !== c.id));
        this.toast.show('success', 'Category deleted');
      },
      error: (err) => this.toast.show('error', err.message),
    });
  }
}
