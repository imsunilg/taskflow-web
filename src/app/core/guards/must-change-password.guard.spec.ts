import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom, isObservable, of } from 'rxjs';
import { mustChangePasswordGuard } from './must-change-password.guard';
import { AuthService } from '../auth/auth.service';

describe('mustChangePasswordGuard', () => {
  let auth: {
    isAuthenticated: ReturnType<typeof vi.fn>;
    isTokenValid: ReturnType<typeof vi.fn>;
    mustChangePassword: ReturnType<typeof vi.fn>;
    restoreSession: ReturnType<typeof vi.fn>;
  };
  let router: { createUrlTree: ReturnType<typeof vi.fn> };
  const REDIRECT = { __changePw: true };

  const run = () => TestBed.runInInjectionContext(() => mustChangePasswordGuard({} as never, {} as never));
  const resolve = async (r: unknown) => (isObservable(r) ? firstValueFrom(r) : r);

  beforeEach(() => {
    auth = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      isTokenValid: vi.fn().mockReturnValue(true),
      mustChangePassword: vi.fn().mockReturnValue(false),
      restoreSession: vi.fn().mockReturnValue(of(true)),
    };
    router = { createUrlTree: vi.fn().mockReturnValue(REDIRECT) };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('allows a normal authenticated user through', async () => {
    expect(await resolve(run())).toBe(true);
  });

  it('redirects to /change-password when the forced-change claim is present', async () => {
    auth.mustChangePassword.mockReturnValue(true);
    expect(await resolve(run())).toBe(REDIRECT);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/change-password']);
  });

  it('restores the session first, then redirects if the claim is set', async () => {
    auth.isAuthenticated.mockReturnValue(false);
    auth.mustChangePassword.mockReturnValue(true);
    expect(await resolve(run())).toBe(REDIRECT);
    expect(auth.restoreSession).toHaveBeenCalled();
  });
});
