import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ThemeService, ThemeMode } from '../../core/services/theme.service';
import { AuthService } from '../../core/auth/auth.service';
import { ChangePasswordDialogComponent } from './change-password-dialog.component';

@Component({
  selector: 'tf-settings',
  standalone: true,
  imports: [ChangePasswordDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="view">
      <header class="view-header">
        <div>
          <h1 class="view-title">Settings</h1>
          <p class="view-subtitle">Manage your profile, appearance, and notification preferences</p>
        </div>
      </header>

      <div class="settings-grid">
        <div class="settings-card">
          <h3>Profile</h3>
          <div class="settings-row">
            <span class="avatar avatar-lg">{{ initials() }}</span>
            <div>
              <div class="user-name">{{ auth.currentUser()?.displayName }}</div>
              <div class="user-email">{{ auth.currentUser()?.email }}</div>
            </div>
          </div>
          <button
            type="button"
            class="btn btn-outline btn-sm"
            style="margin-top:14px"
            (click)="passwordDialogOpen.set(true)"
          >
            Change password
          </button>
        </div>

        <div class="settings-card">
          <h3>Appearance</h3>
          <div class="theme-options" role="radiogroup" aria-label="Theme">
            @for (opt of themeOptions; track opt.mode) {
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="theme.mode() === opt.mode"
                class="theme-option"
                [class.is-active]="theme.mode() === opt.mode"
                (click)="theme.setMode(opt.mode)"
              >
                <span class="theme-swatch" [class]="'theme-swatch-' + opt.mode"></span>
                {{ opt.label }}
              </button>
            }
          </div>
        </div>

        <div class="settings-card">
          <h3>Notifications</h3>
          @for (n of notifPrefs(); track n.key) {
            <label class="switch-row">
              <span>{{ n.label }}</span>
              <input type="checkbox" class="switch" [checked]="n.on" (change)="toggle(n.key)" />
            </label>
          }
        </div>

        <div class="settings-card">
          <h3>Voice &amp; transcription</h3>
          <label class="switch-row">
            <span>Auto-extract due date &amp; priority</span>
            <input type="checkbox" class="switch" [checked]="autoExtract()" (change)="autoExtract.set(!autoExtract())" />
          </label>
          <label class="switch-row">
            <span>Keep audio after transcription</span>
            <input type="checkbox" class="switch" [checked]="keepAudio()" (change)="keepAudio.set(!keepAudio())" />
          </label>
          <p class="settings-hint">
            Transcription provider is configured server-side (Stub for local dev, or a cloud provider by an
            administrator).
          </p>
        </div>
      </div>

      <button type="button" class="btn btn-outline" style="margin-top:18px" (click)="auth.logout()">Sign out</button>
    </section>

    @if (passwordDialogOpen()) {
      <tf-change-password-dialog (closed)="passwordDialogOpen.set(false)" />
    }
  `,
})
export class SettingsComponent {
  readonly theme = inject(ThemeService);
  readonly auth = inject(AuthService);

  readonly passwordDialogOpen = signal(false);

  readonly themeOptions: { mode: ThemeMode; label: string }[] = [
    { mode: 'light', label: 'Light' },
    { mode: 'dark', label: 'Dark' },
    { mode: 'system', label: 'System' },
  ];

  readonly autoExtract = signal(true);
  readonly keepAudio = signal(false);

  readonly notifPrefs = signal([
    { key: 'due', label: 'Due-time reminders', on: true },
    { key: 'digest', label: 'Daily digest at 8:00 AM', on: false },
    { key: 'overdue', label: 'Overdue alerts', on: true },
    { key: 'recurring', label: 'Recurring task previews', on: true },
  ]);

  initials(): string {
    const n = this.auth.currentUser()?.displayName ?? 'U';
    return n
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  toggle(key: string): void {
    this.notifPrefs.update((list) => list.map((p) => (p.key === key ? { ...p, on: !p.on } : p)));
  }
}
