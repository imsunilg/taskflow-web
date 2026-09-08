import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../core/models/api.models';
import { CreateTagRequest, Tag } from '../../core/models/tag.model';
import { ApiService } from '../../core/services/api.service';

@Injectable({ providedIn: 'root' })
export class TagApiService {
  private readonly api = inject(ApiService);

  getTags(): Observable<ApiResponse<Tag[]>> {
    return this.api.get<Tag[]>('/tags');
  }

  createTag(dto: CreateTagRequest): Observable<ApiResponse<Tag>> {
    return this.api.post<Tag>('/tags', dto);
  }

  deleteTag(id: string): Observable<ApiResponse<void>> {
    return this.api.delete<void>(`/tags/${id}`);
  }
}
