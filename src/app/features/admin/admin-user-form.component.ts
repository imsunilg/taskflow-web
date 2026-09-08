import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { UserRole } from '../../core/models/user.model';
import { NormalizedApiError } from '../../core/interceptors/error.interceptor';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { AdminUser, CreateUserPayload, ResetPasswordPayload, UpdateUserPayload } from './admin.models';

export type UserFormSave =
  | { kind: 'create'; data: CreateUserPayload }
  | { kind: 'update'; id: string; data: UpdateUserPayload; resetPassword?: ResetPasswordPayload };

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;
const PASSWORD_HINT =
  'At least 8 characters with an uppercase letter, a lowercase letter and a number.';

function matchPassword(a: string, b: string) {
  return (group: AbstractControl): ValidationErrors | null => {
    const first = group.get(a)?.value;
    const second = group.get(b)?.value;
    return first || second ? (first === second ? null : { passwordMismatch: true }) : null;
  };
}

@Component({
  selector: 'tf-admin-user-form',
  standalone: true,
  imports: [ReactiveFormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="scrim" (click)="tryCancel()"></div>
    <aside class="side-panel" role="dialog" aria-modal="true" [attr.aria-label]="isEdit() ? 'Edit user' : 'Create user'">
      <form class="side-panel-form" [formGroup]="form" (ngSubmit)="submit()">
        <div class="side-panel-header">
          <h2>{{ isEdit() ? 'Edit user' : 'Create user' }}</h2>
          <button class="icon-btn" type="button" (click)="tryCancel()" aria-label="Close">
            <tf-icon name="x" [size]="18" />
          </button>
        </div>

        <div class="side-panel-body">
          @if (serverError(); as e) {
            <div class="form-server-error" role="alert">{{ e }}</div>
          }

          <div class="field">
            <label for="uf-name">Full name <span class="req" aria-hidden="true">*</span></label>
            <input id="uf-name" type="text" formControlName="displayName" autocomplete="off"
              [attr.aria-invalid]="invalid('displayName') ? 'true' : null" />
            @if (invalid('displayName')) {
              <div class="field-error">{{ error('displayName') || 'A name is required.' }}</div>
            }
          </div>

          <div class="field">
            <label for="uf-email">Email <span class="req" aria-hidden="true">*</span></label>
            <input id="uf-email" type="email" formControlName="email" autocomplete="off"
              [attr.aria-invalid]="invalid('email') ? 'true' : null" />
            <p class="field-hint">Used to sign in. This project has no separate username field.</p>
            @if (invalid('email')) {
              <div class="field-error">{{ error('email') || 'Enter a valid email address.' }}</div>
            }
          </div>

          <div class="field-row">
            <div class="field">
              <label for="uf-role">Role</label>
              <select id="uf-role" formControlName="role">
                <option value="User">User</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
            <div class="field">
              <label class="field-checkbox">
                <input type="checkbox" formControlName="isActive" />
                Active
              </label>
              <p class="field-hint">Deactivated users cannot sign in.</p>
            </div>
          </div>

          @if (!isEdit()) {
            <div class="field">
              <label for="uf-pw">Temporary password <span class="req" aria-hidden="true">*</span></label>
              <input id="uf-pw" type="password" formControlName="password" autocomplete="new-password"
                [attr.aria-invalid]="invalid('password') ? 'true' : null" />
              <p class="field-hint">{{ passwordHint }}</p>
              @if (invalid('password')) {
                <div class="field-error">{{ error('password') || passwordHint }}</div>
              }
            </div>
            <div class="field">
              <label for="uf-pw2">Confirm password <span class="req" aria-hidden="true">*</span></label>
              <input id="uf-pw2" type="password" formControlName="confirmPassword" autocomplete="new-password" />
              @if (showMismatch()) {
                <div class="field-error">Passwords do not match.</div>
              }
            </div>
          } @else {
            <div class="field">
              <label class="field-checkbox">
                <input type="checkbox" [checked]="resetOpen()" (change)="toggleReset($event)" />
                Reset password
              </label>
            </div>
            @if (resetOpen()) {
              <div class="field">
                <label for="uf-npw">New password <span class="req" aria-hidden="true">*</span></label>
                <input id="uf-npw" type="password" formControlName="password" autocomplete="new-password"
                  [attr.aria-invalid]="invalid('password') ? 'true' : null" />
                <p class="field-hint">{{ passwordHint }}</p>
                @if (invalid('password')) {
                  <div class="field-error">{{ error('password') || passwordHint }}</div>
                }
              </div>
              <div class="field">
                <label for="uf-npw2">Confirm new password <span class="req" aria-hidden="true">*</span></label>
                <input id="uf-npw2" type="password" formControlName="confirmPassword" autocomplete="new-password" />
                @if (showMismatch()) {
                  <div class="field-error">Passwords do not match.</div>
                }
              </div>
            }
          }
        </div>

        <div class="side-panel-footer">
          <button type="button" class="btn btn-ghost" (click)="tryCancel()" [disabled]="saving()">Cancel</button>
          <button type="submit" class="btn btn-accent" [disabled]="saving()">
            {{ saving() ? 'Saving…' : isEdit() ? 'Save changes' : 'Create user' }}
          </button>
        </div>
      </form>

      @if (confirmItems().length) {
        <div class="modal">
          <div class="modal-card confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="uf-confirm-title">
            <h3 id="uf-confirm-title">Please confirm</h3>
            <p>You are about to:</p>
            <ul class="confirm-list">
              @for (item of confirmItems(); track item) {
                <li>{{ item }}</li>
              }
            </ul>
            <div class="confirm-actions">
              <button class="btn btn-ghost" type="button" (click)="confirmItems.set([])">Back</button>
              <button #confirmBtn class="btn btn-accent" type="button" (click)="emit()">Confirm</button>
            </div>
          </div>
        </div>
      }
    </aside>
  `,
})
export class AdminUserFormComponent {
  private readonly fb = inject(FormBuilder);

  readonly mode = input.required<'create' | 'edit'>();
  readonly user = input<AdminUser | null>(null);
  readonly saving = input(false);
  readonly serverError = input<string | null>(null);

  readonly save = output<UserFormSave>();
  readonly cancel = output<void>();

  readonly passwordHint = PASSWORD_HINT;

  readonly isEdit = computed(() => this.mode() === 'edit');
  readonly resetOpen = signal(false);
  readonly submitted = signal(false);
  readonly confirmItems = signal<string[]>([]);

  private readonly firstInput = viewChild<ElementRef<HTMLInputElement>>('confirmBtn');

  readonly form = this.fb.nonNullable.group(
    {
      displayName: ['', [Validators.required, Validators.maxLength(120)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(320)]],
      role: this.fb.nonNullable.control<UserRole>('User'),
      isActive: this.fb.nonNullable.control(true),
      password: [''],
      confirmPassword: [''],
    },
    { validators: [matchPassword('password', 'confirmPassword')] },
  );

  constructor() {
    effect(() => {
      const u = this.user();
      if (u && this.isEdit()) {
        this.form.patchValue({ displayName: u.displayName, email: u.email, role: u.role, isActive: u.isActive });
      }
      this.applyPasswordValidators();
    });
    // Surface a server-side field error against the matching control.
    effect(() => {
      const msg = this.serverError();
      if (msg) this.submitted.set(true);
    });
  }

  private applyPasswordValidators(): void {
    const required = !this.isEdit() || this.resetOpen();
    const pw = this.form.controls.password;
    const cpw = this.form.controls.confirmPassword;
    const rules = required ? [Validators.required, Validators.pattern(PASSWORD_PATTERN)] : [];
    pw.setValidators(rules);
    cpw.setValidators(required ? [Validators.required] : []);
    pw.updateValueAndValidity({ emitEvent: false });
    cpw.updateValueAndValidity({ emitEvent: false });
  }

  toggleReset(e: Event): void {
    this.resetOpen.set((e.target as HTMLInputElement).checked);
    if (!this.resetOpen()) this.form.patchValue({ password: '', confirmPassword: '' });
    this.applyPasswordValidators();
  }

  invalid(name: 'displayName' | 'email' | 'password'): boolean {
    const c = this.form.controls[name];
    return (this.submitted() || c.touched) && c.invalid;
  }

  error(name: string): string | null {
    return (this.form.get(name)?.errors?.['server'] as string) ?? null;
  }

  showMismatch(): boolean {
    return this.submitted() && this.form.hasError('passwordMismatch');
  }

  applyServerError(err: NormalizedApiError): void {
    this.submitted.set(true);
    for (const item of err?.errors ?? []) {
      const key = (item.field ?? '').split('.').pop()?.toLowerCase() ?? '';
      const map: Record<string, string> = {
        displayname: 'displayName',
        email: 'email',
        password: 'password',
        newpassword: 'password',
        confirmpassword: 'confirmPassword',
        role: 'role',
      };
      const ctrl = this.form.get(map[key] ?? '');
      if (ctrl) {
        ctrl.setErrors({ ...(ctrl.errors ?? {}), server: item.message });
        ctrl.markAsTouched();
      }
    }
  }

  tryCancel(): void {
    if (this.saving()) return;
    if (this.form.dirty && !confirm('Discard your changes?')) return;
    this.cancel.emit();
  }

  submit(): void {
    if (this.saving()) return;
    this.submitted.set(true);
    this.form.markAllAsTouched();
    this.applyPasswordValidators();
    if (this.form.invalid) return;

    const items = this.sensitiveChanges();
    if (items.length) {
      this.confirmItems.set(items);
      queueMicrotask(() => this.firstInput()?.nativeElement?.focus?.());
      return;
    }
    this.emit();
  }

  private sensitiveChanges(): string[] {
    const v = this.form.getRawValue();
    const items: string[] = [];
    if (this.isEdit()) {
      const u = this.user();
      if (u && v.role !== u.role) items.push(`Change role from ${u.role} to ${v.role}`);
      if (u && u.isActive && !v.isActive) items.push('Deactivate this account (existing sessions end)');
      if (this.resetOpen()) items.push('Reset this user’s password');
    } else if (v.role === 'Admin') {
      items.push('Create this account with Admin privileges');
    }
    return items;
  }

  emit(): void {
    this.confirmItems.set([]);
    const v = this.form.getRawValue();
    if (this.isEdit()) {
      const payload: UserFormSave = {
        kind: 'update',
        id: this.user()!.id,
        data: { displayName: v.displayName.trim(), email: v.email.trim(), role: v.role, isActive: v.isActive },
        resetPassword: this.resetOpen()
          ? { newPassword: v.password, confirmPassword: v.confirmPassword }
          : undefined,
      };
      this.save.emit(payload);
    } else {
      this.save.emit({
        kind: 'create',
        data: {
          displayName: v.displayName.trim(),
          email: v.email.trim(),
          role: v.role,
          password: v.password,
          confirmPassword: v.confirmPassword,
          isActive: v.isActive,
        },
      });
    }
  }
}
