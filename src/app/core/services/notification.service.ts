import { Injectable, computed, inject, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../../environments/environment';
import { AppNotification } from '../models/notification.model';
import { NotificationApiService } from '../../features/notifications/notification-api.service';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly api = inject(NotificationApiService);
  private readonly auth = inject(AuthService);
  private connection?: signalR.HubConnection;

  readonly notifications = signal<AppNotification[]>([]);
  readonly unreadCount = computed(() => this.notifications().filter((n) => !n.readAt).length);

  load(): void {
    this.api.getNotifications({ page: 1, pageSize: 50 }).subscribe({
      next: (res) => res.data && this.notifications.set(res.data.items),
      error: () => {},
    });
  }

  connect(): void {
    if (this.connection) return;
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(environment.hubUrl, {
        accessTokenFactory: () => this.auth.getToken() ?? '',
      })
      .withAutomaticReconnect()
      .build();

    this.connection.on('ReceiveNotification', (n: AppNotification) => {
      this.notifications.update((list) => [n, ...list]);
    });

    this.connection.start().catch(() => {});
  }

  disconnect(): void {
    this.connection?.stop();
    this.connection = undefined;
  }

  markRead(id: string): void {
    this.notifications.update((l) =>
      l.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    this.api.markRead(id).subscribe({ error: () => {} });
  }

  markAllRead(): void {
    const now = new Date().toISOString();
    this.notifications.update((l) => l.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    this.api.markAllRead().subscribe({ error: () => {} });
  }
}
