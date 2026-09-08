import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { ApiService } from '../services/api.service';

function jwt(expSecondsFromNow: number, role = 'User', mcp?: string): string {
  const body = btoa(
    JSON.stringify({
      sub: 'u1',
      email: 'demo@taskflow.app',
      name: 'Demo',
      role,
      ...(mcp ? { mcp } : {}),
      exp: Math.floor(Date.now() / 1000) + expSecondsFromNow,
    }),
  );
  return `header.${body}.sig`;
}

describe('AuthService', () => {
  let service: AuthService;
  let api: { post: ReturnType<typeof vi.fn> };
  let router: { url: string; navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    localStorage.clear();
    api = { post: vi.fn().mockReturnValue(of({ success: true, data: null })) };
    router = { url: '/dashboard', navigate: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: ApiService, useValue: api },
        { provide: Router, useValue: router },
      ],
    });
    service = TestBed.inject(AuthService);
  });

  it('restores the session from the refresh cookie and memoizes the call', async () => {
    api.post.mockReturnValue(of({ success: true, data: { accessToken: jwt(900) } }));

    expect(await firstValueFrom(service.restoreSession())).toBe(true);
    expect(await firstValueFrom(service.restoreSession())).toBe(true);

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('returns false and stays signed out when the refresh fails', async () => {
    api.post.mockReturnValue(throwError(() => new Error('401')));

    expect(await firstValueFrom(service.restoreSession())).toBe(false);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('treats an expired access token as not authenticated', () => {
    service.setToken(jwt(-30));
    expect(service.isAuthenticated()).toBe(false);
    expect(service.isTokenValid()).toBe(false);
  });

  it('derives isAdmin from the JWT role claim', () => {
    service.setToken(jwt(900, 'User'));
    expect(service.isAdmin()).toBe(false);
    expect(service.currentUser()?.role).toBe('User');

    service.setToken(jwt(900, 'Admin'));
    expect(service.isAdmin()).toBe(true);
    expect(service.currentUser()?.role).toBe('Admin');
  });

  it('derives mustChangePassword from the mcp claim', () => {
    service.setToken(jwt(900, 'User'));
    expect(service.mustChangePassword()).toBe(false);

    service.setToken(jwt(900, 'User', '1'));
    expect(service.mustChangePassword()).toBe(true);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('forgotPassword posts email + captcha token to the reset endpoint', async () => {
    api.post.mockReturnValue(of({ success: true, message: 'generic', data: 'generic' }));

    await firstValueFrom(service.forgotPassword({ email: 'a@b.c', captchaToken: 'tok' }));

    expect(api.post).toHaveBeenCalledWith('/auth/forgot-password', { email: 'a@b.c', captchaToken: 'tok' });
  });

  it('completePasswordReset installs the fresh token and drops the forced-change claim', async () => {
    service.setToken(jwt(900, 'User', '1'));
    expect(service.mustChangePassword()).toBe(true);
    api.post.mockReturnValue(of({ success: true, data: { accessToken: jwt(900, 'User') } }));

    const res = await firstValueFrom(
      service.completePasswordReset({ newPassword: 'BrandNew99', confirmNewPassword: 'BrandNew99' }),
    );

    expect(res.success).toBe(true);
    expect(api.post).toHaveBeenCalledWith('/auth/complete-password-reset', {
      newPassword: 'BrandNew99', confirmNewPassword: 'BrandNew99',
    });
    expect(service.mustChangePassword()).toBe(false);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('changePassword swaps in the freshly issued access token and keeps the session', async () => {
    service.setToken(jwt(60)); // about to expire
    api.post.mockReturnValue(of({ success: true, data: { accessToken: jwt(900, 'User') } }));

    const res = await firstValueFrom(
      service.changePassword({ currentPassword: 'a', newPassword: 'B', confirmNewPassword: 'B' }),
    );

    expect(res.success).toBe(true);
    expect(api.post).toHaveBeenCalledWith('/auth/change-password', {
      currentPassword: 'a', newPassword: 'B', confirmNewPassword: 'B',
    });
    expect(service.isAuthenticated()).toBe(true);
    expect(service.isTokenValid()).toBe(true);
  });

  it('login starts a fresh idle window', async () => {
    api.post.mockReturnValue(of({ success: true, data: { accessToken: jwt(900), user: {} } }));

    await firstValueFrom(service.login({ email: 'a', password: 'b' }));

    expect(localStorage.getItem('tf_last_activity')).toBeTruthy();
    expect(service.isAuthenticated()).toBe(true);
  });

  it('expireSession surfaces a message, broadcasts to other tabs, and redirects', () => {
    service.setToken(jwt(900));
    router.url = '/tasks';

    service.expireSession('Your session expired due to inactivity');

    expect(service.sessionMessage()).toBe('Your session expired due to inactivity');
    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('tf_session_event')).toContain('logout');
    expect(localStorage.getItem('tf_last_activity')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('followForeignLogout clears local state without re-broadcasting', () => {
    service.setToken(jwt(900));
    router.url = '/dashboard';

    service.followForeignLogout();

    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('tf_session_event')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
