import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse, PagedResult } from '../../core/models/api.models';
import {
  CreateSubtaskRequest,
  CreateTaskRequest,
  Subtask,
  Task,
  TaskQueryParams,
  UpdateSubtaskRequest,
  UpdateTaskRequest,
} from '../../core/models/task.model';
import { ApiService, QueryParams } from '../../core/services/api.service';

@Injectable({ providedIn: 'root' })
export class TaskApiService {
  private readonly api = inject(ApiService);

  getTasks(params: TaskQueryParams = {}): Observable<ApiResponse<PagedResult<Task>>> {
    return this.api.get<PagedResult<Task>>('/tasks', params as QueryParams);
  }

  getTask(id: string): Observable<ApiResponse<Task>> {
    return this.api.get<Task>(`/tasks/${id}`);
  }

  createTask(dto: CreateTaskRequest): Observable<ApiResponse<Task>> {
    return this.api.post<Task>('/tasks', dto);
  }

  updateTask(id: string, dto: UpdateTaskRequest): Observable<ApiResponse<Task>> {
    return this.api.put<Task>(`/tasks/${id}`, dto);
  }

  deleteTask(id: string): Observable<ApiResponse<void>> {
    return this.api.delete<void>(`/tasks/${id}`);
  }

  completeTask(id: string): Observable<ApiResponse<Task>> {
    return this.api.post<Task>(`/tasks/${id}/complete`);
  }

  reopenTask(id: string): Observable<ApiResponse<Task>> {
    return this.api.post<Task>(`/tasks/${id}/reopen`);
  }

  createSubtask(taskId: string, dto: CreateSubtaskRequest): Observable<ApiResponse<Subtask>> {
    return this.api.post<Subtask>(`/tasks/${taskId}/subtasks`, dto);
  }

  updateSubtask(
    taskId: string,
    subtaskId: string,
    dto: UpdateSubtaskRequest,
  ): Observable<ApiResponse<Subtask>> {
    return this.api.put<Subtask>(`/tasks/${taskId}/subtasks/${subtaskId}`, dto);
  }

  deleteSubtask(taskId: string, subtaskId: string): Observable<ApiResponse<void>> {
    return this.api.delete<void>(`/tasks/${taskId}/subtasks/${subtaskId}`);
  }
}
