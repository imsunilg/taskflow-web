import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.models';

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  private buildParams(params?: QueryParams): HttpParams {
    let httpParams = new HttpParams();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
          httpParams = httpParams.set(key, String(value));
        }
      }
    }
    return httpParams;
  }

  get<T>(path: string, params?: QueryParams): Observable<ApiResponse<T>> {
    return this.http.get<ApiResponse<T>>(`${this.baseUrl}${path}`, {
      params: this.buildParams(params),
      withCredentials: true,
    });
  }

  post<T>(path: string, body?: unknown, params?: QueryParams): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(`${this.baseUrl}${path}`, body ?? {}, {
      params: this.buildParams(params),
      withCredentials: true,
    });
  }

  put<T>(path: string, body?: unknown): Observable<ApiResponse<T>> {
    return this.http.put<ApiResponse<T>>(`${this.baseUrl}${path}`, body ?? {}, {
      withCredentials: true,
    });
  }

  patch<T>(path: string, body?: unknown): Observable<ApiResponse<T>> {
    return this.http.patch<ApiResponse<T>>(`${this.baseUrl}${path}`, body ?? {}, {
      withCredentials: true,
    });
  }

  delete<T>(path: string): Observable<ApiResponse<T>> {
    return this.http.delete<ApiResponse<T>>(`${this.baseUrl}${path}`, {
      withCredentials: true,
    });
  }

  postForm<T>(path: string, form: FormData): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(`${this.baseUrl}${path}`, form, {
      withCredentials: true,
    });
  }
}
