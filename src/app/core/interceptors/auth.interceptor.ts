import { HttpErrorResponse, HttpEventType, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, switchMap, take, tap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { IdleService } from '../services/idle.service';

/** Single in-flight refresh shared by every request that 401s while it runs. */
let refresh$: Observable<string | null> | null = null;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const idle = inject(IdleService);

  const token = auth.getToken();
  const isAuthCall = req.url.includes('/auth/');
  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq).pipe(
    tap((event) => {
      if (event.type === HttpEventType.Response && !isAuthCall && auth.isAuthenticated()) {
        idle.recordActivity(); // successful authenticated API call counts as activity
      }
    }),
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || isAuthCall) {
        return throwError(() => error);
      }

      refresh$ ??= auth.refreshToken().pipe(
        map((res) => res.data?.accessToken ?? null),
        catchError(() => of(null)),
        shareReplay(1),
        finalize(() => (refresh$ = null)),
      );

      return refresh$.pipe(
        take(1),
        switchMap((newToken) => {
          if (!newToken) {
            auth.expireSession('Your session has expired. Please sign in again.');
            return throwError(() => error);
          }
          return next(req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } }));
        }),
      );
    }),
  );
};
