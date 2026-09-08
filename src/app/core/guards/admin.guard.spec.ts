import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom, isObservable, of } from 'rxjs';
import { adminGuard } from './admin.guard';
import { AuthService } from '../auth/auth.service';

describe('adminGuard', () => {
  let auth: {
    isAuthenticated: ReturnType<typeof vi.fn>;
    isTokenValid: ReturnType<typeof vi.fn>;
    isAdmin: ReturnType<typeof vi.fn>;
    restoreSession: ReturnType<typeof vi.fn>;
  };
  let router: { createUrlTree: ReturnType<typeof vi.fn> };
  const FORBIDDEN = { __forbidden: true };

  const run = () => TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));
  const resolve = async (r: unknown) => (isObservable(r) ? firstValueFrom(r) : r);

  beforeEach(() => {
    auth = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      isTokenValid: vi.fn().mockReturnValue(true),
      isAdmin: vi.fn().mockReturnValue(false),
      restoreSession: vi.fn().mockReturnValue(of(true)),
    };
    router = { createUrlTree: vi.fn().mockReturnValue(FORBIDDEN) };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('allows an authenticated admin', async () => {
    auth.isAdmin.mockReturnValue(true);
    expect(await resolve(run())).toBe(true);
  });

  it('sends an authenticated non-admin to /forbidden', async () => {
    auth.isAdmin.mockReturnValue(false);
    expect(await resolve(run())).toBe(FORBIDDEN);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/forbidden']);
  });

  it('restores the session first, then allows an admin', async () => {
    auth.isAuthenticated.mockReturnValue(false);
    auth.restoreSession.mockReturnValue(of(true));
    auth.isAdmin.mockReturnValue(true);
    expect(await resolve(run())).toBe(true);
    expect(auth.restoreSession).toHaveBeenCalled();
  });

  it('blocks after restore when the user is not an admin', async () => {
    auth.isAuthenticated.mockReturnValue(false);
    auth.restoreSession.mockReturnValue(of(true));
    auth.isAdmin.mockReturnValue(false);
    expect(await resolve(run())).toBe(FORBIDDEN);
  });
});
