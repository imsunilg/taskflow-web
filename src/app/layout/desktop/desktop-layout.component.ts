import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { TaskStore } from '../../core/services/task.store';
import { UiStateService } from '../../core/services/ui-state.service';
import { SearchService } from '../../core/services/search.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ThemeService } from '../../core/services/theme.service';
import { CategoryApiService } from '../../features/categories/category-api.service';
import { TagApiService } from '../../features/tags/tag-api.service';
import { Category } from '../../core/models/category.model';
import { Tag } from '../../core/models/tag.model';
import { QuickAddComponent } from '../../shared/components/quick-add/quick-add.component';
import { TaskDetailComponent } from '../../shared/components/task-detail/task-detail.component';
import { FilterPanelComponent } from '../../shared/components/filter-panel/filter-panel.component';
import { VoiceComponent } from '../../features/voice/voice.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'tf-desktop-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    QuickAddComponent,
    TaskDetailComponent,
    FilterPanelComponent,
    VoiceComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKey($event)' },
  template: `
    <a class="skip-link" href="#main">Skip to main content</a>

    <div class="app-shell">
      <!-- desktop topbar -->
      <header class="topbar">
        <div class="topbar-left">
          <button class="icon-btn" type="button" (click)="ui.toggleSidebarDrawer()" aria-label="Toggle sidebar">
            <tf-icon name="menu" [size]="20" />
          </button>
          <span class="brand"><tf-icon name="logo" [size]="16" class="brand-mark" /> TaskFlow</span>
        </div>

        <div class="topbar-search">
          <tf-icon name="search" [size]="16" />
          <input
            #search
            type="search"
            placeholder="Search tasks, notes, tags…"
            (input)="onSearch(search.value)"
            aria-label="Global search"
          />
          <kbd class="search-kbd">/</kbd>
        </div>

        <div class="topbar-right">
          <button class="btn btn-accent btn-sm" type="button" (click)="ui.openQuickAdd()">
            <tf-icon name="plus" [size]="16" /> Quick add
          </button>
          <button class="icon-btn" type="button" (click)="ui.openVoice()" aria-label="Create task by voice">
            <tf-icon name="mic" [size]="19" />
          </button>
          <div class="popover-wrap">
            <button
              class="icon-btn"
              type="button"
              (click)="toggleNotif()"
              aria-label="Notifications"
              aria-haspopup="true"
            >
              <tf-icon name="bell" [size]="19" />
              @if (notifications.unreadCount()) {
                <span class="notif-badge">{{ notifications.unreadCount() }}</span>
              }
            </button>
            @if (notifOpen()) {
              <div class="popover">
                <div class="popover-header">
                  <span>Notifications</span>
                  <button class="text-btn" type="button" (click)="notifications.markAllRead()">Mark all read</button>
                </div>
                <div class="popover-body">
                  @for (n of notifications.notifications().slice(0, 8); track n.id) {
                    <div class="notif-item" [class.is-unread]="!n.readAt">
                      <span class="notif-icon" [class]="'type-' + n.type.toLowerCase()">
                        {{ n.type === 'Overdue' ? '!' : n.type === 'Recurring' ? '↻' : '⏰' }}
                      </span>
                      <div><div class="notif-title">{{ n.title }}</div></div>
                    </div>
                  } @empty {
                    <div style="padding:16px" class="muted">No notifications.</div>
                  }
                </div>
              </div>
            }
          </div>
          <div class="popover-wrap">
            <button class="avatar" type="button" (click)="toggleUser()" aria-label="Account menu">{{ initials() }}</button>
            @if (userOpen()) {
              <div class="popover user-popover">
                <div class="user-popover-header">
                  <span class="avatar avatar-lg">{{ initials() }}</span>
                  <div>
                    <div class="user-name">{{ auth.currentUser()?.displayName }}</div>
                    <div class="user-email">{{ auth.currentUser()?.email }}</div>
                  </div>
                </div>
                <a class="popover-item" routerLink="/settings" (click)="userOpen.set(false)">Settings</a>
                <button class="popover-item" type="button" (click)="theme.setMode(theme.mode() === 'dark' ? 'light' : 'dark')">
                  Toggle appearance
                </button>
                <button class="popover-item popover-item-danger" type="button" (click)="auth.logout()">Sign out</button>
              </div>
            }
          </div>
        </div>
      </header>

      <!-- mobile header -->
      <header class="mobile-header">
        <button class="icon-btn" type="button" (click)="ui.toggleSidebarDrawer()" aria-label="Menu">
          <tf-icon name="menu" [size]="20" />
        </button>
        <span class="brand"><tf-icon name="logo" [size]="15" class="brand-mark" /> <span class="brand-name">TaskFlow</span></span>
        <div class="mobile-header-actions">
          <button class="icon-btn" type="button" (click)="mobileSearchOpen.set(!mobileSearchOpen())" aria-label="Search">
            <tf-icon name="search" [size]="19" />
          </button>
          <button class="icon-btn" type="button" (click)="goNotifications()" aria-label="Notifications">
            <tf-icon name="bell" [size]="19" />
            @if (notifications.unreadCount()) { <span class="notif-badge">{{ notifications.unreadCount() }}</span> }
          </button>
        </div>
      </header>
      @if (mobileSearchOpen()) {
        <div class="mobile-search-bar">
          <tf-icon name="search" [size]="16" />
          <input
            #msearch
            type="search"
            placeholder="Search tasks…"
            (input)="onSearch(msearch.value)"
            aria-label="Search tasks"
          />
        </div>
      }

      <!-- sidebar -->
      <nav class="app-sidebar" [class.is-open]="ui.sidebarDrawerOpen()" aria-label="Primary">
        <div class="sidebar-scroll">
          <div class="nav-group">
            <a routerLink="/tasks/inbox" routerLinkActive="is-active" class="nav-item" (click)="closeDrawer()">
              <tf-icon name="inbox" class="nav-icon" /> <span class="nav-label">Inbox</span>
              <span class="nav-count">{{ store.counts().inbox }}</span>
            </a>
            <a routerLink="/tasks/today" routerLinkActive="is-active" class="nav-item" (click)="closeDrawer()">
              <tf-icon name="sun" class="nav-icon" /> <span class="nav-label">Today</span>
              <span class="nav-count">{{ store.counts().today }}</span>
            </a>
            <a routerLink="/tasks/upcoming" routerLinkActive="is-active" class="nav-item" (click)="closeDrawer()">
              <tf-icon name="chevron-right" class="nav-icon" /> <span class="nav-label">Upcoming</span>
              <span class="nav-count">{{ store.counts().upcoming }}</span>
            </a>
            <a routerLink="/calendar" routerLinkActive="is-active" class="nav-item" (click)="closeDrawer()">
              <tf-icon name="calendar" class="nav-icon" /> <span class="nav-label">Calendar</span>
            </a>
            <a routerLink="/tasks/all" routerLinkActive="is-active" class="nav-item" (click)="closeDrawer()">
              <tf-icon name="layers" class="nav-icon" /> <span class="nav-label">All tasks</span>
              <span class="nav-count">{{ store.counts().all }}</span>
            </a>
            <a routerLink="/tasks/important" routerLinkActive="is-active" class="nav-item" (click)="closeDrawer()">
              <tf-icon name="star" class="nav-icon" /> <span class="nav-label">Important</span>
              <span class="nav-count">{{ store.counts().important }}</span>
            </a>
            <a routerLink="/tasks/overdue" routerLinkActive="is-active" class="nav-item" (click)="closeDrawer()">
              <tf-icon name="alert" class="nav-icon nav-icon-danger" /> <span class="nav-label">Overdue</span>
              <span class="nav-count nav-count-danger">{{ store.counts().overdue }}</span>
            </a>
            <a routerLink="/tasks/completed" routerLinkActive="is-active" class="nav-item" (click)="closeDrawer()">
              <tf-icon name="check" class="nav-icon" /> <span class="nav-label">Completed</span>
              <span class="nav-count">{{ store.counts().completed }}</span>
            </a>
          </div>

          <div class="nav-divider"></div>

          <div class="nav-group">
            <div class="nav-group-header"><span>Categories</span></div>
            @for (c of categories(); track c.id) {
              <a
                [routerLink]="['/tasks/all']"
                [queryParams]="{ category: c.id }"
                class="nav-item"
                (click)="closeDrawer()"
              >
                <span class="category-dot" [style.background]="c.color"></span>
                <span class="nav-label">{{ c.name }}</span>
              </a>
            }
            <a routerLink="/categories" routerLinkActive="is-active" class="nav-item nav-item-muted" (click)="closeDrawer()">
              <tf-icon name="grid" class="nav-icon" /> <span class="nav-label">Manage categories</span>
            </a>
          </div>

          <div class="nav-divider"></div>

          <div class="nav-group">
            <div class="nav-group-header"><span>Tags</span></div>
            @for (t of tags().slice(0, 6); track t.id) {
              <a [routerLink]="['/tasks/all']" [queryParams]="{ tag: t.name }" class="tag-chip-inline" (click)="closeDrawer()">
                #{{ t.name }}
              </a>
            }
            <a routerLink="/tags" routerLinkActive="is-active" class="nav-item nav-item-muted" (click)="closeDrawer()">
              <tf-icon name="tag" class="nav-icon" /> <span class="nav-label">Manage tags</span>
            </a>
          </div>
        </div>

        <div class="sidebar-footer">
          @if (auth.isAdmin()) {
            <a routerLink="/admin" routerLinkActive="is-active" class="nav-item" (click)="closeDrawer()">
              <tf-icon name="sliders" class="nav-icon" /> <span class="nav-label">Admin</span>
            </a>
          }
          <a routerLink="/settings" routerLinkActive="is-active" class="nav-item" (click)="closeDrawer()">
            <tf-icon name="settings" class="nav-icon" /> <span class="nav-label">Settings</span>
          </a>
        </div>
      </nav>

      <main id="main" class="main-content"><router-outlet /></main>
    </div>

    <!-- mobile bottom nav -->
    <nav class="bottom-nav" aria-label="Primary">
      <a class="bottom-nav-item" routerLink="/dashboard" routerLinkActive="is-active">
        <tf-icon name="grid" [size]="21" /> <span>Home</span>
      </a>
      <a class="bottom-nav-item" routerLink="/tasks/today" routerLinkActive="is-active">
        <tf-icon name="sun" [size]="21" /> <span>Today</span>
      </a>
      <button class="bottom-nav-fab" type="button" (click)="ui.openQuickAdd()" aria-label="Add task">
        <tf-icon name="plus" [size]="24" [strokeWidth]="2.2" />
      </button>
      <a class="bottom-nav-item" routerLink="/calendar" routerLinkActive="is-active">
        <tf-icon name="calendar" [size]="21" /> <span>Calendar</span>
      </a>
      <a class="bottom-nav-item" routerLink="/settings" routerLinkActive="is-active">
        <span class="avatar avatar-sm">{{ initials() }}</span> <span>Me</span>
      </a>
    </nav>

    <!-- overlays -->
    @if (ui.sidebarDrawerOpen()) {
      <div class="scrim mobile-only" (click)="closeDrawer()"></div>
    }
    @if (ui.quickAddOpen() || ui.detailTaskId() || ui.voiceOpen() || ui.filterPanelOpen()) {
      <div class="scrim" (click)="ui.closeTopmost()"></div>
    }
    @if (ui.quickAddOpen()) { <tf-quick-add /> }
    @if (ui.detailTaskId()) { <tf-task-detail /> }
    @if (ui.filterPanelOpen()) { <tf-filter-panel /> }
    @if (ui.voiceOpen()) {
      <div class="modal">
        <div class="modal-card voice-card">
          <button class="icon-btn modal-close" type="button" (click)="ui.closeVoice()" aria-label="Close">
            <tf-icon name="x" [size]="18" />
          </button>
          <tf-voice />
        </div>
      </div>
    }

    <div class="toast-container" role="status" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast" [class]="t.variant">
          <span class="toast-icon">{{ t.variant === 'success' ? '✓' : t.variant === 'error' ? '!' : 'i' }}</span>
          <span>{{ t.message }}</span>
          <button class="toast-close" type="button" (click)="toast.dismiss(t.id)" aria-label="Dismiss">×</button>
        </div>
      }
    </div>
  `,
})
export class DesktopLayoutComponent implements OnInit {
  readonly store = inject(TaskStore);
  readonly ui = inject(UiStateService);
  readonly search = inject(SearchService);
  readonly notifications = inject(NotificationService);
  readonly auth = inject(AuthService);
  readonly toast = inject(ToastService);
  readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly categoryApi = inject(CategoryApiService);
  private readonly tagApi = inject(TagApiService);

  readonly categories = signal<Category[]>([]);
  readonly tags = signal<Tag[]>([]);
  readonly notifOpen = signal(false);
  readonly userOpen = signal(false);
  readonly mobileSearchOpen = signal(false);

  private readonly searchInput$ = new Subject<string>();

  initials(): string {
    const n = this.auth.currentUser()?.displayName ?? 'U';
    return n
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  ngOnInit(): void {
    this.store.loadTasks();
    this.notifications.load();
    this.notifications.connect();
    this.categoryApi.getCategories().subscribe({ next: (r) => r.data && this.categories.set(r.data) });
    this.tagApi.getTags().subscribe({ next: (r) => r.data && this.tags.set(r.data) });

    this.searchInput$.pipe(debounceTime(250)).subscribe((q) => {
      this.search.setQuery(q);
      this.router.navigate(['/tasks/all'], { queryParams: { search: q || null }, queryParamsHandling: 'merge' });
    });
  }

  onSearch(value: string): void {
    this.searchInput$.next(value);
  }

  toggleNotif(): void {
    this.notifOpen.update((v) => !v);
    this.userOpen.set(false);
  }
  toggleUser(): void {
    this.userOpen.update((v) => !v);
    this.notifOpen.set(false);
  }
  closeDrawer(): void {
    this.ui.sidebarDrawerOpen.set(false);
  }
  goNotifications(): void {
    this.router.navigate(['/notifications']);
  }

  onKey(e: KeyboardEvent): void {
    const tag = (e.target as HTMLElement)?.tagName;
    if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
      e.preventDefault();
      (document.querySelector('.topbar-search input') as HTMLInputElement | null)?.focus();
    }
    if (e.key === 'Escape') {
      this.notifOpen.set(false);
      this.userOpen.set(false);
      this.ui.closeTopmost();
    }
  }
}
