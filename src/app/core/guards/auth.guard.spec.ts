import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom, isObservable, of } from 'rxjs';
import { authGuard } from './auth.guard';
import { AuthService } from '../auth/auth.service';
import { IdleService } from '../services/idle.service';

describe('authGuard', () => {
  let auth: {
    isAuthenticated: ReturnType<typeof vi.fn>;
    isTokenValid: ReturnType<typeof vi.fn>;
    restoreSession: ReturnType<typeof vi.fn>;
    expireSession: ReturnType<typeof vi.fn>;
  };
  let idle: { isExpiredByStoredActivity: ReturnType<typeof vi.fn> };
  let router: { createUrlTree: ReturnType<typeof vi.fn> };

  const LOGIN_TREE = { __login: true };
  const state = { url: '/tasks' } as never;
  const route = {} as never;

  const run = () => TestBed.runInInjectionContext(() => authGuard(route, state));
  const resolve = async (r: unknown) => (isObservable(r) ? firstValueFrom(r) : r);

  beforeEach(() => {
    auth = {
      isAuthenticated: vi.fn().mockReturnValue(false),
      isTokenValid: vi.fn().mockReturnValue(false),
      restoreSession: vi.fn().mockReturnValue(of(false)),
      expireSession: vi.fn(),
    };
    idle = { isExpiredByStoredActivity: vi.fn().mockReturnValue(false) };
    router = { createUrlTree: vi.fn().mockReturnValue(LOGIN_TREE) };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: IdleService, useValue: idle },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('allows navigation when already authenticated with a valid token', async () => {
    auth.isAuthenticated.mockReturnValue(true);
    auth.isTokenValid.mockReturnValue(true);

    expect(await resolve(run())).toBe(true);
    expect(auth.restoreSession).not.toHaveBeenCalled();
  });

  it('restores the session after a refresh instead of bouncing to /login', async () => {
    auth.restoreSession.mockReturnValue(of(true));

    expect(await resolve(run())).toBe(true);
    expect(auth.restoreSession).toHaveBeenCalledTimes(1);
  });

  it('redirects to /login with a returnUrl when there is no session', async () => {
    auth.restoreSession.mockReturnValue(of(false));

    expect(await resolve(run())).toBe(LOGIN_TREE);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/tasks' } });
  });

  it('expires the session and redirects when the idle window already elapsed', async () => {
    auth.isAuthenticated.mockReturnValue(true);
    auth.isTokenValid.mockReturnValue(true);
    idle.isExpiredByStoredActivity.mockReturnValue(true);

    expect(await resolve(run())).toBe(LOGIN_TREE);
    expect(auth.expireSession).toHaveBeenCalled();
  });
});
