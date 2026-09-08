import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../auth/auth.service';

/**
 * After a one-time-password reset login the JWT carries the `mcp` claim. Until the user
 * sets a new password, every protected route sends them to /change-password. The backend
 * enforces the same rule (403 must_change_password) — this is just the UX side.
 */
export const mustChangePasswordGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const decide = () =>
    auth.mustChangePassword() ? router.createUrlTree(['/change-password']) : true;

  if (auth.isAuthenticated() && auth.isTokenValid()) {
    return decide();
  }
  return auth.restoreSession().pipe(map(decide));
};
