import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../core/models/api.models';
import {
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from '../../core/models/category.model';
import { ApiService } from '../../core/services/api.service';

@Injectable({ providedIn: 'root' })
export class CategoryApiService {
  private readonly api = inject(ApiService);

  getCategories(): Observable<ApiResponse<Category[]>> {
    return this.api.get<Category[]>('/categories');
  }

  createCategory(dto: CreateCategoryRequest): Observable<ApiResponse<Category>> {
    return this.api.post<Category>('/categories', dto);
  }

  updateCategory(id: string, dto: UpdateCategoryRequest): Observable<ApiResponse<Category>> {
    return this.api.put<Category>(`/categories/${id}`, dto);
  }

  deleteCategory(id: string): Observable<ApiResponse<void>> {
    return this.api.delete<void>(`/categories/${id}`);
  }
}
