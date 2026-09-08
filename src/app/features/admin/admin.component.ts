import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { NormalizedApiError } from '../../core/interceptors/error.interceptor';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { AdminApiService } from './admin-api.service';
import { AdminUserFormComponent, UserFormSave } from './admin-user-form.component';
import { AdminStatusFilter, AdminUser, AdminUserSort, AdminUserSummary } from './admin.models';

interface PendingAction {
  user: AdminUser;
  activate?: boolean;
  kind: 'status' | 'delete';
}

@Component({
  selector: 'tf-admin',
  standalone: true,
  imports: [FormsModule, DatePipe, IconComponent, AdminUserFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="view admin-view">
      <div class="view-header admin-header">
        <div>
          <h1 class="view-title">User management</h1>
          <p class="muted">Create, edit, activate/deactivate or delete accounts. Every change is audited.</p>
        </div>
        <button class="btn btn-accent" type="button" (click)="openCreate()">
          <tf-icon name="plus" [size]="16" /> Create user
        </button>
      </div>

      <div class="admin-stat-grid" aria-label="User summary">
        <div class="stat-card">
          <div class="stat-label">Total users</div>
          <div class="stat-value">{{ summary()?.totalUsers ?? '—' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Active</div>
          <div class="stat-value" style="color:var(--success)">{{ summary()?.activeUsers ?? '—' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Deactivated</div>
          <div class="stat-value" style="color:var(--danger)">{{ summary()?.deactivatedUsers ?? '—' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">New (7 days)</div>
          <div class="stat-value">{{ summary()?.newUsersLast7Days ?? '—' }}</div>
        </div>
      </div>

      <div class="admin-toolbar">
        <div class="admin-search">
          <tf-icon name="search" [size]="16" />
          <input
            type="search"
            [ngModel]="search()"
            (ngModelChange)="onSearch($event)"
            placeholder="Search name, email or user ID"
            aria-label="Search users"
          />
        </div>
        <div class="view-toggle" role="tablist" aria-label="Filter by status">
          @for (f of filters; track f.value) {
            <button
              type="button"
              role="tab"
              class="view-toggle-btn"
              [attr.aria-selected]="status() === f.value"
              [class.is-active]="status() === f.value"
              (click)="setStatus(f.value)"
            >
              {{ f.label }}
            </button>
          }
        </div>
        <label class="admin-include-deleted">
          <input type="checkbox" [ngModel]="includeDeleted()" (ngModelChange)="setIncludeDeleted($event)" />
          Include deleted
        </label>
      </div>

      @if (error()) {
        <div class="error-state" role="alert">
          <p>{{ error() }}</p>
          <button class="btn btn-outline" type="button" (click)="load()">Retry</button>
        </div>
      } @else {
        <div class="admin-table-wrap" role="region" aria-label="Users" tabindex="0">
          <table class="admin-table">
            <thead>
              <tr>
                <th scope="col">User ID</th>
                <th scope="col">
                  <button type="button" class="col-sort" (click)="setSort('displayName')">
                    Name {{ sortIcon('displayName') }}
                  </button>
                </th>
                <th scope="col">
                  <button type="button" class="col-sort" (click)="setSort('email')">Email {{ sortIcon('email') }}</button>
                </th>
                <th scope="col">
                  <button type="button" class="col-sort" (click)="setSort('role')">Role {{ sortIcon('role') }}</button>
                </th>
                <th scope="col">
                  <button type="button" class="col-sort" (click)="setSort('status')">Status {{ sortIcon('status') }}</button>
                </th>
                <th scope="col">
                  <button type="button" class="col-sort" (click)="setSort('createdAt')">
                    Created {{ sortIcon('createdAt') }}
                  </button>
                </th>
                <th scope="col">
                  <button type="button" class="col-sort" (click)="setSort('lastLoginAt')">
                    Last login {{ sortIcon('lastLoginAt') }}
                  </button>
                </th>
                <th scope="col" class="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              @if (loading()) {
                @for (r of skeletonRows; track r) {
                  <tr class="is-skeleton">
                    <td colspan="8"><span class="skeleton-block"></span></td>
                  </tr>
                }
              } @else if (users().length === 0) {
                <tr>
                  <td colspan="8" class="admin-empty">No users match your search.</td>
                </tr>
              } @else {
                @for (u of users(); track u.id) {
                  <tr [class.is-inactive]="!u.isActive">
                    <td class="mono">{{ shortId(u.id) }}</td>
                    <td>
                      {{ u.displayName }}
                      @if (isSelf(u)) { <span class="tag-pill">you</span> }
                      @if (u.isDeleted) { <span class="tag-pill">deleted</span> }
                    </td>
                    <td>{{ u.email }}</td>
                    <td><span class="role-badge" [class.is-admin]="u.role === 'Admin'">{{ u.role }}</span></td>
                    <td>
                      <span class="status-badge" [class.is-active]="u.isActive">
                        {{ u.isDeleted ? 'Deleted' : u.isActive ? 'Active' : 'Deactivated' }}
                      </span>
                    </td>
                    <td>{{ u.createdAt | date: 'mediumDate' }}</td>
                    <td>{{ u.lastLoginAt ? (u.lastLoginAt | date: 'short') : '—' }}</td>
                    <td class="col-actions">
                      <div class="admin-row-actions">
                        <button
                          class="btn btn-sm btn-ghost"
                          type="button"
                          [disabled]="u.isDeleted || working() === u.id"
                          [attr.aria-label]="'Edit ' + u.displayName"
                          (click)="openEdit(u)"
                        >
                          Edit
                        </button>
                        @if (!u.isDeleted) {
                          @if (u.isActive) {
                            <button
                              class="btn btn-sm btn-outline btn-danger"
                              type="button"
                              [disabled]="isSelf(u) || working() === u.id"
                              [title]="isSelf(u) ? 'You cannot deactivate your own account' : ''"
                              [attr.aria-label]="'Deactivate ' + u.displayName"
                              (click)="ask(u, false)"
                            >
                              {{ working() === u.id ? '…' : 'Deactivate' }}
                            </button>
                          } @else {
                            <button
                              class="btn btn-sm btn-accent"
                              type="button"
                              [disabled]="working() === u.id"
                              [attr.aria-label]="'Activate ' + u.displayName"
                              (click)="ask(u, true)"
                            >
                              {{ working() === u.id ? '…' : 'Activate' }}
                            </button>
                          }
                          <button
                            class="btn btn-sm btn-danger"
                            type="button"
                            [disabled]="isSelf(u) || working() === u.id"
                            [title]="isSelf(u) ? 'You cannot delete your own account' : ''"
                            [attr.aria-label]="'Delete ' + u.displayName"
                            (click)="askDelete(u)"
                          >
                            Delete
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        <div class="admin-pager">
          <span class="muted">
            {{ total() === 0 ? 0 : rangeStart() }}–{{ rangeEnd() }} of {{ total() }}
          </span>
          <div class="admin-pager-btns">
            <button
              class="btn btn-sm btn-ghost"
              type="button"
              [disabled]="page() <= 1 || loading()"
              (click)="goToPage(page() - 1)"
            >
              Previous
            </button>
            <span class="muted">Page {{ page() }} / {{ totalPages() || 1 }}</span>
            <button
              class="btn btn-sm btn-ghost"
              type="button"
              [disabled]="page() >= totalPages() || loading()"
              (click)="goToPage(page() + 1)"
            >
              Next
            </button>
          </div>
        </div>
      }
    </div>

    @if (formMode(); as mode) {
      <tf-admin-user-form
        [mode]="mode"
        [user]="editing()"
        [saving]="formSaving()"
        [serverError]="formError()"
        (save)="onFormSave($event)"
        (cancel)="closeForm()"
      />
    }

    @if (pending(); as p) {
      <div class="scrim" (click)="pending.set(null)"></div>
      <div class="modal">
        <div
          class="modal-card confirm-card"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="admin-confirm-title"
        >
          @if (p.kind === 'delete') {
            <h3 id="admin-confirm-title">Delete {{ p.user.displayName }}?</h3>
            <p>
              <strong>{{ p.user.displayName }}</strong> ({{ p.user.email }}) will be soft-deleted: signed out,
              blocked from signing in, and hidden from the user list. Their data is retained and an admin can
              restore access later. This does not permanently erase the account.
            </p>
          } @else {
            <h3 id="admin-confirm-title">
              {{ p.activate ? 'Activate' : 'Deactivate' }} {{ p.user.displayName }}?
            </h3>
            <p>
              @if (p.activate) {
                {{ p.user.displayName }} will be able to sign in again.
              } @else {
                {{ p.user.displayName }} will be signed out and blocked from signing in until reactivated.
              }
            </p>
          }
          <div class="confirm-actions">
            <button class="btn btn-ghost" type="button" (click)="pending.set(null)">Cancel</button>
            <button
              class="btn"
              [class.btn-accent]="p.kind === 'status' && p.activate"
              [class.btn-danger]="p.kind === 'delete' || !p.activate"
              type="button"
              [disabled]="working() !== null"
              (click)="confirm(p)"
            >
              {{ working() ? 'Working…' : p.kind === 'delete' ? 'Delete' : p.activate ? 'Activate' : 'Deactivate' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AdminComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly summary = signal<AdminUserSummary | null>(null);
  readonly users = signal<AdminUser[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = 20;
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly status = signal<AdminStatusFilter>('all');
  readonly sort = signal<AdminUserSort>('createdAt');
  readonly desc = signal(true);
  readonly search = signal('');
  readonly includeDeleted = signal(false);
  readonly pending = signal<PendingAction | null>(null);
  readonly working = signal<string | null>(null);

  readonly formMode = signal<'create' | 'edit' | null>(null);
  readonly editing = signal<AdminUser | null>(null);
  readonly formSaving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly filters: { label: string; value: AdminStatusFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Deactivated', value: 'deactivated' },
  ];
  readonly skeletonRows = Array.from({ length: 6 }, (_, i) => i);

  readonly totalPages = computed(() => Math.ceil(this.total() / this.pageSize));
  readonly rangeStart = computed(() => (this.page() - 1) * this.pageSize + 1);
  readonly rangeEnd = computed(() => Math.min(this.page() * this.pageSize, this.total()));

  private readonly search$ = new Subject<string>();

  ngOnInit(): void {
    this.search$.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.page.set(1);
      this.load();
    });
    this.loadSummary();
    this.load();
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.search$.next(value);
  }

  setStatus(value: AdminStatusFilter): void {
    if (this.status() === value) return;
    this.status.set(value);
    this.page.set(1);
    this.load();
  }

  setIncludeDeleted(value: boolean): void {
    this.includeDeleted.set(value);
    this.page.set(1);
    this.load();
  }

  setSort(col: AdminUserSort): void {
    if (this.sort() === col) this.desc.update((d) => !d);
    else {
      this.sort.set(col);
      this.desc.set(col === 'createdAt' || col === 'lastLoginAt');
    }
    this.load();
  }

  sortIcon(col: AdminUserSort): string {
    if (this.sort() !== col) return '';
    return this.desc() ? '↓' : '↑';
  }

  goToPage(n: number): void {
    if (n < 1 || n > this.totalPages()) return;
    this.page.set(n);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.adminApi
      .getUsers({
        search: this.search().trim() || undefined,
        status: this.status(),
        sort: this.sort(),
        desc: this.desc(),
        page: this.page(),
        pageSize: this.pageSize,
        includeDeleted: this.includeDeleted() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          if (res.success && res.data) {
            this.users.set(res.data.items);
            this.total.set(res.data.total);
          }
        },
        error: (err: NormalizedApiError) => {
          this.loading.set(false);
          this.error.set(err?.message || 'Could not load users.');
        },
      });
  }

  private loadSummary(): void {
    this.adminApi.getSummary().subscribe({
      next: (res) => res.data && this.summary.set(res.data),
      error: () => {},
    });
  }

  isSelf(u: AdminUser): boolean {
    return u.id === this.auth.currentUser()?.id;
  }

  // ---- create / edit drawer ----

  openCreate(): void {
    this.editing.set(null);
    this.formError.set(null);
    this.formSaving.set(false);
    this.formMode.set('create');
  }

  openEdit(u: AdminUser): void {
    this.editing.set(u);
    this.formError.set(null);
    this.formSaving.set(false);
    this.formMode.set('edit');
  }

  closeForm(): void {
    if (this.formSaving()) return;
    this.formMode.set(null);
    this.editing.set(null);
  }

  onFormSave(evt: UserFormSave): void {
    this.formSaving.set(true);
    this.formError.set(null);

    if (evt.kind === 'create') {
      this.adminApi.createUser(evt.data).subscribe({
        next: (res) => this.afterFormSave(res.success, res.message || 'User created.'),
        error: (err: NormalizedApiError) => this.formFailed(err),
      });
      return;
    }

    this.adminApi.updateUser(evt.id, evt.data).subscribe({
      next: (res) => {
        if (!res.success) return this.formFailed({ status: 400, message: res.message, errors: res.errors });
        if (evt.resetPassword) {
          this.adminApi.resetPassword(evt.id, evt.resetPassword).subscribe({
            next: (r2) => this.afterFormSave(r2.success, 'User updated and password reset.'),
            error: (err: NormalizedApiError) => this.formFailed(err),
          });
        } else {
          this.afterFormSave(true, res.message || 'User updated.');
        }
      },
      error: (err: NormalizedApiError) => this.formFailed(err),
    });
  }

  private afterFormSave(success: boolean, message: string): void {
    this.formSaving.set(false);
    if (!success) {
      this.formError.set(message);
      return;
    }
    this.formMode.set(null);
    this.editing.set(null);
    this.toast.show('success', message);
    this.load();
    this.loadSummary();
  }

  private formFailed(err: NormalizedApiError): void {
    this.formSaving.set(false);
    const fieldMsg = err?.errors?.[0]?.message;
    this.formError.set(fieldMsg || err?.message || 'Could not save the user.');
  }

  // ---- status / delete confirm ----

  ask(user: AdminUser, activate: boolean): void {
    if (!activate && this.isSelf(user)) return;
    this.pending.set({ user, activate, kind: 'status' });
  }

  askDelete(user: AdminUser): void {
    if (this.isSelf(user)) return;
    this.pending.set({ user, kind: 'delete' });
  }

  confirm(action: { user: AdminUser; activate?: boolean; kind?: 'status' | 'delete' }): void {
    if (this.working()) return;
    this.working.set(action.user.id);

    const done = (res: { success: boolean; message: string; data: AdminUser | null }, fallback: string) => {
      this.working.set(null);
      this.pending.set(null);
      if (res.success && res.data) {
        const updated = res.data;
        if (action.kind === 'delete' && !this.includeDeleted()) {
          this.users.update((list) => list.filter((u) => u.id !== updated.id));
          this.total.update((t) => Math.max(0, t - 1));
        } else {
          this.users.update((list) => list.map((u) => (u.id === updated.id ? updated : u)));
        }
        this.toast.show('success', res.message || fallback);
        this.loadSummary();
      } else {
        this.toast.show('error', res.message || 'Update failed.');
      }
    };
    const fail = (err: NormalizedApiError) => {
      this.working.set(null);
      this.pending.set(null);
      this.toast.show('error', err?.message || 'Update failed.');
    };

    if (action.kind === 'delete') {
      this.adminApi.deleteUser(action.user.id).subscribe({ next: (r) => done(r, 'User deleted.'), error: fail });
    } else {
      this.adminApi
        .setStatus(action.user.id, !!action.activate)
        .subscribe({ next: (r) => done(r, 'User updated.'), error: fail });
    }
  }

  shortId(id: string): string {
    return id.length > 13 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
  }
}
