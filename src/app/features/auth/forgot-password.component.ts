import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { NormalizedApiError } from '../../core/interceptors/error.interceptor';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { CaptchaComponent } from './captcha.component';

@Component({
  selector: 'tf-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, CaptchaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-shell">
      <aside class="auth-aside">
        <div class="auth-aside-brand"><tf-icon name="logo" [size]="20" class="brand-mark" /> TaskFlow</div>
        <div class="auth-aside-copy">
          <h2>Locked out? It happens.</h2>
          <p>We'll email you a one-time code. Use it to sign in once, then pick a new password.</p>
        </div>
        <div class="muted" style="font-size:12px">© TaskFlow</div>
      </aside>

      <main class="auth-main">
        <div class="auth-card">
          <div class="auth-card-brand"><tf-icon name="logo" [size]="18" class="brand-mark" /> TaskFlow</div>

          @if (done()) {
            <h1>Check your email</h1>
            <p class="auth-sub">{{ message() }}</p>
            <p class="auth-notice" role="status">
              The code expires in about 15 minutes. Sign in with it, then set a new password immediately.
            </p>
            <a class="btn btn-accent btn-block" routerLink="/login">Back to sign in</a>
          } @else {
            <h1>Forgot your password?</h1>
            <p class="auth-sub">Enter your account email and we'll send reset instructions.</p>

            <form class="auth-form" (submit)="submit($event)">
              @if (error()) { <div class="auth-error" role="alert">{{ error() }}</div> }

              <div class="field">
                <label for="fp-email">Email</label>
                <input
                  id="fp-email"
                  type="email"
                  name="email"
                  [(ngModel)]="email"
                  autocomplete="email"
                  required
                  [attr.aria-invalid]="error() ? 'true' : null"
                />
              </div>

              <div class="field">
                <span class="field-label">Verification</span>
                <tf-captcha (token)="captchaToken.set($event)" />
                @if (captchaError()) {
                  <div class="field-error">{{ captchaError() }}</div>
                }
              </div>

              <button
                class="btn btn-accent btn-block"
                type="submit"
                [disabled]="loading() || !captchaToken()"
              >
                {{ loading() ? 'Sending…' : 'Email me a reset code' }}
              </button>
            </form>

            <p class="auth-hint"><a routerLink="/login">Remembered it? Sign in</a></p>
          }
        </div>
      </main>
    </div>
  `,
})
export class ForgotPasswordComponent {
  private readonly auth = inject(AuthService);

  email = '';
  readonly captchaToken = signal<string | null>(null);
  readonly loading = signal(false);
  readonly done = signal(false);
  readonly message = signal('');
  readonly error = signal<string | null>(null);
  readonly captchaError = signal<string | null>(null);

  submit(e: Event): void {
    e.preventDefault();
    if (this.loading()) return;
    this.error.set(null);
    this.captchaError.set(null);

    const token = this.captchaToken();
    if (!token) {
      this.captchaError.set('Please complete the verification.');
      return;
    }

    this.loading.set(true);
    this.auth.forgotPassword({ email: this.email.trim(), captchaToken: token }).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.message.set(res.message || res.data || 'If an account exists for this email address, we have sent reset instructions.');
          this.done.set(true);
        } else {
          this.error.set(res.message || 'Could not send reset instructions.');
        }
      },
      error: (err: NormalizedApiError) => {
        this.loading.set(false);
        const captcha = err?.errors?.find((x) => x.field === 'captchaToken');
        if (captcha) {
          this.captchaError.set(captcha.message);
          this.captchaToken.set(null);
        } else {
          this.error.set(err?.message || 'Could not send reset instructions.');
        }
      },
    });
  }
}
