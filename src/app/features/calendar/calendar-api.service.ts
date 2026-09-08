import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../core/models/api.models';
import { Task } from '../../core/models/task.model';
import { ApiService } from '../../core/services/api.service';

@Injectable({ providedIn: 'root' })
export class CalendarApiService {
  private readonly api = inject(ApiService);

  getCalendarTasks(from: string, to: string): Observable<ApiResponse<Task[]>> {
    return this.api.get<Task[]>('/calendar', { from, to });
  }
}
