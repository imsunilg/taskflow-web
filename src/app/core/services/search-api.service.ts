import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models/api.models';
import { Task } from '../models/task.model';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class SearchApiService {
  private readonly api = inject(ApiService);

  search(query: string): Observable<ApiResponse<Task[]>> {
    return this.api.get<Task[]>('/search', { q: query });
  }
}
