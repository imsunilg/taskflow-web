import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse, PagedResult } from '../../core/models/api.models';
import { AppNotification } from '../../core/models/notification.model';
import { ApiService, QueryParams } from '../../core/services/api.service';

@Injectable({ providedIn: 'root' })
export class NotificationApiService {
  private readonly api = inject(ApiService);

  getNotifications(
    params: { page?: number; pageSize?: number } = {},
  ): Observable<ApiResponse<PagedResult<AppNotification>>> {
    return this.api.get<PagedResult<AppNotification>>('/notifications', params as QueryParams);
  }

  markRead(id: string): Observable<ApiResponse<void>> {
    return this.api.post<void>(`/notifications/${id}/read`);
  }

  markAllRead(): Observable<ApiResponse<void>> {
    return this.api.post<void>('/notifications/read-all');
  }
}
