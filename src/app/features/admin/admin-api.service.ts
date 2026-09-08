import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse, PagedResult } from '../../core/models/api.models';
import { ApiService, QueryParams } from '../../core/services/api.service';
import {
  AdminUser,
  AdminUserQuery,
  AdminUserSummary,
  CreateUserPayload,
  ResetPasswordPayload,
  UpdateUserPayload,
} from './admin.models';

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly api = inject(ApiService);

  getSummary(): Observable<ApiResponse<AdminUserSummary>> {
    return this.api.get<AdminUserSummary>('/admin/users/summary');
  }

  getUsers(query: AdminUserQuery): Observable<ApiResponse<PagedResult<AdminUser>>> {
    return this.api.get<PagedResult<AdminUser>>('/admin/users', query as QueryParams);
  }

  getUser(id: string): Observable<ApiResponse<AdminUser>> {
    return this.api.get<AdminUser>(`/admin/users/${id}`);
  }

  createUser(payload: CreateUserPayload): Observable<ApiResponse<AdminUser>> {
    return this.api.post<AdminUser>('/admin/users', payload);
  }

  updateUser(id: string, payload: UpdateUserPayload): Observable<ApiResponse<AdminUser>> {
    return this.api.put<AdminUser>(`/admin/users/${id}`, payload);
  }

  resetPassword(id: string, payload: ResetPasswordPayload): Observable<ApiResponse<AdminUser>> {
    return this.api.post<AdminUser>(`/admin/users/${id}/reset-password`, payload);
  }

  deleteUser(id: string): Observable<ApiResponse<AdminUser>> {
    return this.api.delete<AdminUser>(`/admin/users/${id}`);
  }

  setStatus(id: string, isActive: boolean, reason?: string): Observable<ApiResponse<AdminUser>> {
    return this.api.patch<AdminUser>(`/admin/users/${id}/status`, { isActive, reason: reason ?? null });
  }
}
