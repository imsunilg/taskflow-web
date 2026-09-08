import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'tf-notifications',
  standalone: true,
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="view">
      <header class="view-header">
        <div>
          <h1 class="view-title">Notifications</h1>
          <p class="view-subtitle">Reminders, overdue alerts, and recurring-task previews</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-ghost btn-sm" type="button" (click)="svc.markAllRead()">Mark all read</button>
        </div>
      </header>

      @if (svc.notifications().length) {
        <div class="rail-card" style="padding:0">
          @for (n of svc.notifications(); track n.id) {
            <button type="button" class="notif-item" [class.is-unread]="!n.readAt" (click)="svc.markRead(n.id)">
              <span class="notif-icon" [class]="'type-' + n.type.toLowerCase()">
                {{ n.type === 'Overdue' ? '!' : n.type === 'Recurring' ? '↻' : '⏰' }}
              </span>
              <div>
                <div class="notif-title">{{ n.title }}</div>
                <div class="notif-time">{{ n.createdAt | date: 'MMM d, h:mm a' }}</div>
              </div>
            </button>
          }
        </div>
      } @else {
        <div class="empty-state">
          <div class="empty-illustration">🔔</div>
          <h3>You're all caught up</h3>
          <p>New reminders and alerts will appear here.</p>
        </div>
      }
    </section>
  `,
})
export class NotificationsComponent implements OnInit {
  readonly svc = inject(NotificationService);
  ngOnInit(): void {
    this.svc.load();
  }
}
