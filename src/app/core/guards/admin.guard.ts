import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../auth/auth.service';

/**
 * Frontend gate for /admin routes. Pair it with `authGuard` in the route config.
 * Real enforcement is server-side ([Authorize(Roles="Admin")]); this only keeps a
 * non-admin from seeing the admin shell.
 */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const decide = () => (auth.isAdmin() ? true : router.createUrlTree(['/forbidden']));

  if (auth.isAuthenticated() && auth.isTokenValid()) {
    return decide();
  }
  return auth.restoreSession().pipe(map(decide));
};
