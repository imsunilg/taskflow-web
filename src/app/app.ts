import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { IdleService } from './core/services/idle.service';
import { SessionWarningComponent } from './core/auth/session-warning.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SessionWarningComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />
    <tf-session-warning />
  `,
})
export class App {
  // Instantiating ThemeService here applies the persisted theme on startup.
  private readonly theme = inject(ThemeService);
  // Instantiating IdleService wires up its auth-state effect (idle tracking).
  private readonly idle = inject(IdleService);
}
