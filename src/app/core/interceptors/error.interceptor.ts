import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ApiError } from '../models/api.models';

export interface NormalizedApiError {
  status: number;
  message: string;
  errors: ApiError[];
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const body = error.error ?? {};
      const errors: ApiError[] = Array.isArray(body.errors) ? body.errors : [];
      const normalized: NormalizedApiError = {
        status: error.status,
        message: body.message || error.message || 'An unexpected error occurred.',
        errors,
      };

      // The account is mid password-reset: the backend blocks every protected call with
      // 403 must_change_password. Send the user to the forced change-password page.
      if (
        error.status === 403 &&
        errors.some((e) => e.message === 'must_change_password') &&
        !router.url.startsWith('/change-password')
      ) {
        router.navigate(['/change-password']);
      }

      return throwError(() => normalized);
    }),
  );
};
