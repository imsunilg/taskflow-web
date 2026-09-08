import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { NormalizedApiError } from '../../core/interceptors/error.interceptor';
import { IconComponent } from '../../shared/components/icon/icon.component';

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;

function crossFieldRules(group: AbstractControl): ValidationErrors | null {
  const current = group.get('currentPassword')?.value ?? '';
  const next = group.get('newPassword')?.value ?? '';
  const confirm = group.get('confirmNewPassword')?.value ?? '';
  const errors: ValidationErrors = {};
  if (next && current && next === current) errors['sameAsCurrent'] = true;
  if (confirm && next && confirm !== next) errors['mismatch'] = true;
  return Object.keys(errors).length ? errors : null;
}

@Component({
  selector: 'tf-change-password-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'requestClose()' },
  template: `
    <div class="scrim" (click)="requestClose()"></div>
    <div class="modal">
      <div
        class="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cpw-title"
        (keydown.escape)="requestClose()"
      >
        <button class="icon-btn modal-close" type="button" (click)="requestClose()" aria-label="Close">
          <tf-icon name="x" [size]="18" />
        </button>
        <h3 id="cpw-title">Change password</h3>

        <form class="cpw-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          @if (serverError()) {
            <div class="form-server-error" role="alert">{{ serverError() }}</div>
          }

          <div class="field">
            <label for="cpw-current">Current password</label>
            <div class="cpw-input">
              <input
                #currentInput
                id="cpw-current"
                [type]="show().current ? 'text' : 'password'"
                formControlName="currentPassword"
                autocomplete="current-password"
                [attr.aria-invalid]="invalid('currentPassword') ? 'true' : null"
              />
              <button
                type="button"
                class="cpw-toggle"
                [attr.aria-label]="show().current ? 'Hide current password' : 'Show current password'"
                [attr.aria-pressed]="show().current"
                (click)="toggle('current')"
              >
                <tf-icon [name]="show().current ? 'eye-off' : 'eye'" [size]="16" />
              </button>
            </div>
            @if (invalid('currentPassword')) {
              <div class="field-error">{{ fieldError('currentPassword') || 'Enter your current password.' }}</div>
            }
          </div>

          <div class="field">
            <label for="cpw-new">New password</label>
            <div class="cpw-input">
              <input
                id="cpw-new"
                [type]="show().next ? 'text' : 'password'"
                formControlName="newPassword"
                autocomplete="new-password"
                [attr.aria-invalid]="invalid('newPassword') ? 'true' : null"
                aria-describedby="cpw-policy"
              />
              <button
                type="button"
                class="cpw-toggle"
                [attr.aria-label]="show().next ? 'Hide new password' : 'Show new password'"
                [attr.aria-pressed]="show().next"
                (click)="toggle('next')"
              >
                <tf-icon [name]="show().next ? 'eye-off' : 'eye'" [size]="16" />
              </button>
            </div>
            <ul id="cpw-policy" class="cpw-policy">
              <li>8–128 characters</li>
              <li>at least one uppercase and one lowercase letter</li>
              <li>at least one number</li>
              <li>different from your current password</li>
            </ul>
            @if (invalid('newPassword')) {
              <div class="field-error">{{ newPasswordError() }}</div>
            }
          </div>

          <div class="field">
            <label for="cpw-confirm">Confirm new password</label>
            <div class="cpw-input">
              <input
                id="cpw-confirm"
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
            @if (showMismatch()) {
              <div class="field-error">Passwords do not match.</div>
            }
          </div>

          <div class="confirm-actions">
            <button type="button" class="btn btn-ghost" (click)="requestClose()" [disabled]="submitting()">
              Cancel
            </button>
            <button type="submit" class="btn btn-accent" [disabled]="submitting()">
              {{ submitting() ? 'Changing…' : 'Change password' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class ChangePasswordDialogComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly closed = output<void>();

  private readonly currentInput = viewChild<ElementRef<HTMLInputElement>>('currentInput');

  readonly submitting = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly showSubmitted = signal(false);
  readonly show = signal({ current: false, next: false, confirm: false });

  readonly form = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.pattern(PASSWORD_PATTERN)]],
      confirmNewPassword: ['', [Validators.required]],
    },
    { validators: [crossFieldRules] },
  );

  ngOnInit(): void {
    queueMicrotask(() => this.currentInput()?.nativeElement?.focus?.());
  }

  ngOnDestroy(): void {
    this.wipe();
  }

  toggle(which: 'current' | 'next' | 'confirm'): void {
    this.show.update((s) => ({ ...s, [which]: !s[which] }));
  }

  invalid(name: 'currentPassword' | 'newPassword' | 'confirmNewPassword'): boolean {
    const c = this.form.controls[name];
    return (this.showSubmitted() || c.touched) && c.invalid;
  }

  fieldError(name: string): string | null {
    return (this.form.get(name)?.errors?.['server'] as string) ?? null;
  }

  showMismatch(): boolean {
    return (
      (this.showSubmitted() || this.form.controls.confirmNewPassword.touched) &&
      (this.form.hasError('mismatch') || this.form.controls.confirmNewPassword.hasError('required'))
    );
  }

  newPasswordError(): string {
    const c = this.form.controls.newPassword;
    if (c.hasError('server')) return c.errors!['server'];
    if (c.hasError('required')) return 'Enter a new password.';
    if (this.form.hasError('sameAsCurrent')) return 'The new password must be different from your current password.';
    return 'Password must meet all the requirements above.';
  }

  requestClose(): void {
    if (this.submitting()) return;
    this.wipe();
    this.closed.emit();
  }

  submit(): void {
    if (this.submitting()) return;
    this.showSubmitted.set(true);
    this.serverError.set(null);
    this.form.markAllAsTouched();

    if (this.form.invalid) return;

    const { currentPassword, newPassword, confirmNewPassword } = this.form.getRawValue();
    this.submitting.set(true);

    this.auth
      .changePassword({ currentPassword, newPassword, confirmNewPassword })
      .subscribe({
        next: (res) => {
          this.submitting.set(false);
          if (res.success) {
            this.toast.show('success', res.message || 'Your password has been changed.');
            this.wipe();
            this.closed.emit();
          } else {
            this.applyServerError({ status: 400, message: res.message, errors: res.errors });
          }
        },
        error: (err: NormalizedApiError) => {
          this.submitting.set(false);
          this.applyServerError(err);
        },
      });
  }

  private applyServerError(err: NormalizedApiError): void {
    const items = Array.isArray(err?.errors) ? err.errors : [];
    let mappedAny = false;
    for (const item of items) {
      const key = (item.field ?? '').split('.').pop()?.toLowerCase() ?? '';
      const map: Record<string, string> = {
        currentpassword: 'currentPassword',
        newpassword: 'newPassword',
        confirmnewpassword: 'confirmNewPassword',
      };
      const ctrl = this.form.get(map[key] ?? '');
      if (ctrl) {
        ctrl.setErrors({ ...(ctrl.errors ?? {}), server: item.message });
        ctrl.markAsTouched();
        mappedAny = true;
      }
    }
    this.showSubmitted.set(true);
    this.serverError.set(mappedAny ? null : err?.message || 'Could not change your password. Please try again.');
  }

  /** Clear every password field from memory. */
  private wipe(): void {
    this.form.reset({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    this.show.set({ current: false, next: false, confirm: false });
    this.serverError.set(null);
    this.showSubmitted.set(false);
  }
}
