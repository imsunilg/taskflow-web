import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { NormalizedApiError } from '../../core/interceptors/error.interceptor';
import { IconComponent } from '../../shared/components/icon/icon.component';

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;

function matches(group: AbstractControl): ValidationErrors | null {
  const a = group.get('newPassword')?.value;
  const b = group.get('confirmNewPassword')?.value;
  return !a || !b || a === b ? null : { mismatch: true };
}

/**
 * Dedicated forced-password-change page shown after a one-time-password reset login.
 * No current password is required — the OTP already authenticated the user. Every other
 * route bounces here (mustChangePasswordGuard) until this succeeds.
 */
@Component({
  selector: 'tf-force-change-password',
  standalone: true,
  imports: [ReactiveFormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-shell">
      <aside class="auth-aside">
        <div class="auth-aside-brand"><tf-icon name="logo" [size]="20" class="brand-mark" /> TaskFlow</div>
        <div class="auth-aside-copy">
          <h2>One last step.</h2>
          <p>Your temporary password worked. Set a password you'll keep — it replaces the code for good.</p>
        </div>
        <div class="muted" style="font-size:12px">© TaskFlow</div>
      </aside>

      <main class="auth-main">
        <div class="auth-card">
          <div class="auth-card-brand"><tf-icon name="logo" [size]="18" class="brand-mark" /> TaskFlow</div>
          <h1>Create a new password</h1>
          <p class="auth-sub">You're signed in with a one-time code. Choose a new password to continue.</p>

          <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
            @if (serverError()) { <div class="auth-error" role="alert">{{ serverError() }}</div> }

            <div class="field">
              <label for="fcp-new">New password</label>
              <div class="cpw-input">
                <input
                  id="fcp-new"
                  [type]="show().next ? 'text' : 'password'"
                  formControlName="newPassword"
                  autocomplete="new-password"
                  aria-describedby="fcp-policy"
                  [attr.aria-invalid]="invalid('newPassword') ? 'true' : null"
                />
                <button
                  type="button"
                  class="cpw-toggle"
                  [attr.aria-label]="show().next ? 'Hide password' : 'Show password'"
                  [attr.aria-pressed]="show().next"
                  (click)="toggle('next')"
                >
                  <tf-icon [name]="show().next ? 'eye-off' : 'eye'" [size]="16" />
                </button>
              </div>
              <ul id="fcp-policy" class="cpw-policy">
                <li>8–128 characters</li>
                <li>at least one uppercase and one lowercase letter</li>
                <li>at least one number</li>
              </ul>
              @if (invalid('newPassword')) {
                <div class="field-error">{{ newError() }}</div>
              }
            </div>

            <div class="field">
              <label for="fcp-confirm">Confirm new password</label>
              <div class="cpw-input">
                <input
                  id="fcp-confirm"
                  [type]="show().confirm ? 'text' : 'password'"
                  formControlName="confirmNewPassword"
                  autocomplete="new-password"
                  [attr.aria-invalid]="showMismatch() ? 'true' : null"
                />
                <button
                  type="button"
                  class="cpw-toggle"
                  [attr.aria-label]="show().confirm ? 'Hide confirmation' : 'Show confirmation'"
                  [attr.aria-pressed]="show().confirm"
                  (click)="toggle('confirm')"
                >
                  <tf-icon [name]="show().confirm ? 'eye-off' : 'eye'" [size]="16" />
                </button>
              </div>
              @if (showMismatch()) { <div class="field-error">Passwords do not match.</div> }
            </div>

            <button class="btn btn-accent btn-block" type="submit" [disabled]="submitting()">
              {{ submitting() ? 'Saving…' : 'Set password and continue' }}
            </button>
          </form>

          <p class="auth-hint">
            <button type="button" class="linklike" (click)="signOut()">Sign out instead</button>
          </p>
        </div>
      </main>
    </div>
  `,
  styles: [
    `.linklike { background: none; border: 0; color: var(--accent); cursor: pointer; font: inherit; padding: 0; }`,
  ],
})
export class ForceChangePasswordComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly submitting = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly submitted = signal(false);
  readonly show = signal({ next: false, confirm: false });

  readonly form = this.fb.nonNullable.group(
    {
      newPassword: ['', [Validators.required, Validators.pattern(PASSWORD_PATTERN)]],
      confirmNewPassword: ['', [Validators.required]],
    },
    { validators: [matches] },
  );

  ngOnInit(): void {
    // Not actually in the forced state (e.g. navigated here directly) — send them home.
    if (this.auth.isAuthenticated() && !this.auth.mustChangePassword()) {
      this.router.navigateByUrl(this.returnUrl);
    }
  }

  ngOnDestroy(): void {
    this.form.reset({ newPassword: '', confirmNewPassword: '' });
  }

  private get returnUrl(): string {
    const url = this.route.snapshot.queryParamMap.get('returnUrl');
    return url && !url.startsWith('/login') && !url.startsWith('/change-password') ? url : '/dashboard';
  }

  toggle(which: 'next' | 'confirm'): void {
    this.show.update((s) => ({ ...s, [which]: !s[which] }));
  }

  invalid(name: 'newPassword' | 'confirmNewPassword'): boolean {
    const c = this.form.controls[name];
    return (this.submitted() || c.touched) && c.invalid;
  }

  showMismatch(): boolean {
    return (
      (this.submitted() || this.form.controls.confirmNewPassword.touched) &&
      (this.form.hasError('mismatch') || this.form.controls.confirmNewPassword.hasError('required'))
    );
  }

  newError(): string {
    const c = this.form.controls.newPassword;
    if (c.hasError('server')) return c.errors!['server'];
    if (c.hasError('required')) return 'Enter a new password.';
    return 'Password must meet all the requirements above.';
  }

  submit(): void {
    if (this.submitting()) return;
    this.submitted.set(true);
    this.serverError.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const { newPassword, confirmNewPassword } = this.form.getRawValue();
    this.submitting.set(true);
    this.auth.completePasswordReset({ newPassword, confirmNewPassword }).subscribe({
      next: (res) => {
        this.submitting.set(false);
        if (res.success) {
          this.form.reset({ newPassword: '', confirmNewPassword: '' });
          this.toast.show('success', res.message || 'Your new password is set.');
          this.router.navigateByUrl(this.returnUrl);
        } else {
          this.applyError({ status: 400, message: res.message, errors: res.errors });
        }
      },
      error: (err: NormalizedApiError) => {
        this.submitting.set(false);
        this.applyError(err);
      },
    });
  }

  private applyError(err: NormalizedApiError): void {
    this.submitted.set(true);
    let mapped = false;
    for (const item of err?.errors ?? []) {
      const key = (item.field ?? '').split('.').pop()?.toLowerCase() ?? '';
      const ctrl =
        key === 'newpassword'
          ? this.form.controls.newPassword
          : key === 'confirmnewpassword'
            ? this.form.controls.confirmNewPassword
            : null;
      if (ctrl) {
        ctrl.setErrors({ ...(ctrl.errors ?? {}), server: item.message });
        ctrl.markAsTouched();
        mapped = true;
      }
    }
    this.serverError.set(mapped ? null : err?.message || 'Could not set your password. Please try again.');
  }

  signOut(): void {
    this.auth.logout();
  }
}
