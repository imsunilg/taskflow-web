import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { IdleService } from '../services/idle.service';

/**
 * Waits for session restoration before deciding, so a page refresh (which starts
 * with an empty in-memory token) does not bounce the user to /login while the
 * refresh-cookie exchange is still in flight.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const idle = inject(IdleService);
  const router = inject(Router);

  const toLogin = () => router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });

  const decide = (authenticated: boolean) => {
    if (!authenticated) return toLogin();
    if (idle.isExpiredByStoredActivity()) {
      auth.expireSession('Your session expired due to inactivity');
      return toLogin();
    }
    return true;
  };

  if (auth.isAuthenticated() && auth.isTokenValid()) {
    return decide(true);
  }
  return auth.restoreSession().pipe(map(decide));
};
