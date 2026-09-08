import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from './auth.service';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'tf-login',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-shell">
      <aside class="auth-aside">
        <div class="auth-aside-brand"><tf-icon name="logo" [size]="20" class="brand-mark" /> TaskFlow</div>
        <div class="auth-aside-copy">
          <h2>One place for everything you need to do.</h2>
          <p>
            Fast capture by keyboard or voice, structured organisation with subtasks and recurrence, and a Today
            view that never lies.
          </p>
          <div class="auth-aside-points">
            <div class="auth-aside-point"><span class="dot"></span> Capture a task in under 5 seconds</div>
            <div class="auth-aside-point"><span class="dot"></span> Reminders that actually fire</div>
            <div class="auth-aside-point"><span class="dot"></span> Works on desktop and mobile</div>
          </div>
        </div>
        <div class="muted" style="font-size:12px">© TaskFlow</div>
      </aside>

      <main class="auth-main">
        <div class="auth-card">
          <div class="auth-card-brand"><tf-icon name="logo" [size]="18" class="brand-mark" /> TaskFlow</div>
          <h1>Welcome back</h1>
          <p class="auth-sub">Sign in to continue to your workspace.</p>

          <form class="auth-form" (submit)="submit($event)">
            @if (error()) { <div class="auth-error" role="alert">{{ error() }}</div> }
            @if (!error() && notice()) { <div class="auth-notice" role="status">{{ notice() }}</div> }

            <div class="field">
              <label for="email">Email</label>
              <input id="email" type="email" name="email" [(ngModel)]="email" autocomplete="username" required />
            </div>
            <div class="field">
              <div class="field-label-row">
                <label for="password">Password</label>
                <a class="auth-inline-link" routerLink="/forgot-password">Forgot password?</a>
              </div>
              <input
                id="password"
                type="password"
                name="password"
                [(ngModel)]="password"
                autocomplete="current-password"
                required
              />
            </div>

            <button class="btn btn-accent btn-block" type="submit" [disabled]="loading()">
              {{ loading() ? 'Signing in…' : 'Sign in' }}
            </button>
          </form>

          <p class="auth-hint">
            Demo account — <b>demo&#64;taskflow.app</b> / <b>password123</b>
          </p>
        </div>
      </main>
    </div>
  `,
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  email = '';
  password = '';
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  private get returnUrl(): string {
    const url = this.route.snapshot.queryParamMap.get('returnUrl');
    return url && !url.startsWith('/login') ? url : '/dashboard';
  }

  ngOnInit(): void {
    this.notice.set(this.auth.sessionMessage());
    // Already have a valid session (e.g. opened /login in a second tab)? Move on.
    if (this.auth.isAuthenticated() && this.auth.isTokenValid()) {
      this.router.navigateByUrl(this.returnUrl);
    }
  }

  submit(e: Event): void {
    e.preventDefault();
    this.loading.set(true);
    this.error.set(null);
    this.notice.set(null);
    this.auth.login({ email: this.email, password: this.password }).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (!res.success) {
          this.error.set(res.message || 'Login failed');
          return;
        }
        // Signed in with a one-time reset password → force a new password first.
        if (res.data?.mustChangePassword || this.auth.mustChangePassword()) {
          this.router.navigate(['/change-password'], { queryParams: { returnUrl: this.returnUrl } });
        } else {
          this.router.navigateByUrl(this.returnUrl);
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.message ?? 'Login failed');
      },
    });
  }
}
