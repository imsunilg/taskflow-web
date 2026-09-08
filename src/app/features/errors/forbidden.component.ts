import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'tf-forbidden',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="view">
      <div class="empty-state" role="alert" style="max-width:420px;margin:12vh auto 0">
        <div class="empty-illustration"><tf-icon name="alert" [size]="40" /></div>
        <h2>Access denied</h2>
        <p class="muted">
          You don't have permission to view this page. If you think this is a mistake, contact an administrator.
        </p>
        <a class="btn btn-accent" routerLink="/dashboard">Back to dashboard</a>
      </div>
    </div>
  `,
})
export class ForbiddenComponent {}
