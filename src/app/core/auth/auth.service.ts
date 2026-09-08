import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, shareReplay, tap } from 'rxjs';
import { ApiResponse } from '../models/api.models';
import { AuthResult, LoginRequest, User } from '../models/user.model';
import { ApiService } from '../services/api.service';

interface JwtPayload {
  sub: string;
  email: string;
  name?: string;
  role?: string;
  /** "1" when the account must set a new password before using anything else. */
  mcp?: string;
  exp: number;
}

export interface CaptchaConfig {
  provider: 'turnstile' | 'recaptcha' | 'hcaptcha' | 'disabled';
  siteKey: string;
  /** DEV ONLY: token to submit when provider is "disabled". Empty otherwise. */
  devBypassToken: string;
}

const LAST_ACTIVITY_KEY = 'tf_last_activity';
const SESSION_EVENT_KEY = 'tf_session_event';
const CLOCK_SKEW_MS = 10_000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  /**
   * Access token — kept in memory only (never in localStorage). It is re-obtained
   * on every page load from the HttpOnly `tf_refresh` cookie via restoreSession().
   */
  private readonly accessToken = signal<string | null>(null);

  /** Message to surface on the login screen after an involuntary logout. */
  readonly sessionMessage = signal<string | null>(null);

  /** Memoized in-flight restore so parallel guards share one /auth/refresh call. */
  private restore$?: Observable<boolean>;

  readonly currentUser = computed<User | null>(() => {
    const token = this.accessToken();
    if (!token) return null;
    const payload = this.decode(token);
    if (!payload || payload.exp * 1000 <= Date.now()) return null;
    return {
      id: payload.sub,
      email: payload.email,
      displayName: payload.name ?? payload.email,
      role: payload.role === 'Admin' ? 'Admin' : 'User',
    };
  });

  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly isAdmin = computed(() => this.currentUser()?.role === 'Admin');

  /** True while the JWT carries the forced-password-change claim. */
  readonly mustChangePassword = computed(() => {
    const token = this.accessToken();
    const payload = token ? this.decode(token) : null;
    return !!payload && payload.exp * 1000 > Date.now() && payload.mcp === '1';
  });

  getToken(): string | null {
    return this.accessToken();
  }

  setToken(token: string | null): void {
    this.accessToken.set(token);
  }

  /** ms until the current access token expires (negative / -1 when none or invalid). */
  tokenExpiresInMs(): number {
    const token = this.accessToken();
    const payload = token ? this.decode(token) : null;
    return payload ? payload.exp * 1000 - Date.now() : -1;
  }

  isTokenValid(): boolean {
    return this.tokenExpiresInMs() > CLOCK_SKEW_MS;
  }

  login(credentials: LoginRequest): Observable<ApiResponse<AuthResult>> {
    return this.api.post<AuthResult>('/auth/login', credentials).pipe(
      tap((res) => {
        if (res.success && res.data) {
          this.accessToken.set(res.data.accessToken);
          this.sessionMessage.set(null);
          this.restore$ = undefined;
          this.touchActivity(); // start a fresh 15-minute idle window
        }
      }),
    );
  }

  /**
   * Change the signed-in user's password. The backend rotates the account security stamp
   * (killing every other session) and hands back a fresh access token + refresh cookie, so
   * this session stays signed in (Option A). If no fresh token comes back we fail closed.
   */
  changePassword(body: {
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
  }): Observable<ApiResponse<{ accessToken: string; user: User }>> {
    return this.api.post<{ accessToken: string; user: User }>('/auth/change-password', body).pipe(
      tap((res) => {
        if (res.success && res.data?.accessToken) {
          this.accessToken.set(res.data.accessToken);
          this.sessionMessage.set(null);
          this.restore$ = undefined;
          this.touchActivity();
        } else if (res.success) {
          this.expireSession('Your password was changed. Please sign in again.');
        }
      }),
    );
  }

  /** Public CAPTCHA config for the forgot-password widget (no secret). */
  getCaptchaConfig(): Observable<ApiResponse<CaptchaConfig>> {
    return this.api.get<CaptchaConfig>('/auth/captcha-config');
  }

  /** Request a one-time reset password by email. Response is always generic. */
  forgotPassword(body: { email: string; captchaToken: string }): Observable<ApiResponse<string>> {
    return this.api.post<string>('/auth/forgot-password', body);
  }

  /**
   * Finish the forced password change after a one-time-password login. The backend
   * rotates the security stamp and returns a fresh access token (and refresh cookie),
   * so the user continues in this session without the forced-change claim.
   */
  completePasswordReset(body: {
    newPassword: string;
    confirmNewPassword: string;
  }): Observable<ApiResponse<{ accessToken: string; user: User }>> {
    return this.api.post<{ accessToken: string; user: User }>('/auth/complete-password-reset', body).pipe(
      tap((res) => {
        if (res.success && res.data?.accessToken) {
          this.accessToken.set(res.data.accessToken);
          this.sessionMessage.set(null);
          this.restore$ = undefined;
          this.touchActivity();
        }
      }),
    );
  }

  refreshToken(): Observable<ApiResponse<AuthResult>> {
    return this.api.post<AuthResult>('/auth/refresh').pipe(
      tap((res) => {
        if (res.success && res.data) this.accessToken.set(res.data.accessToken);
      }),
    );
  }

  /**
   * Restore the session from the refresh cookie. Called by the app initializer and
   * the route guard, so it is memoized until it resolves. Does NOT touch the idle
   * timestamp — a refresh must continue the existing idle window, not restart it.
   */
  restoreSession(): Observable<boolean> {
    if (this.isAuthenticated() && this.isTokenValid()) return of(true);

    this.restore$ ??= this.api.post<AuthResult>('/auth/refresh').pipe(
      map((res) => {
        if (!(res.success && res.data?.accessToken)) return false;
        this.accessToken.set(res.data.accessToken);
        return true;
      }),
      catchError(() => of(false)),
      shareReplay(1),
    );
    return this.restore$;
  }

  /** User-initiated sign-out. */
  logout(): void {
    this.api.post('/auth/logout').subscribe({ next: () => {}, error: () => {} });
    this.finishLogout(null);
  }

  /** Involuntary sign-out (idle timeout, or refresh failure on a 401). */
  expireSession(message = 'Your session expired due to inactivity'): void {
    if (!this.isAuthenticated() && !this.accessToken()) {
      // already gone — still make sure the message + redirect happen
      this.sessionMessage.set(message);
      this.redirectToLogin();
      return;
    }
    this.api.post('/auth/logout').subscribe({ next: () => {}, error: () => {} });
    this.finishLogout(message);
  }

  /** Another tab signed out / expired — mirror it here without re-broadcasting. */
  followForeignLogout(): void {
    this.accessToken.set(null);
    this.restore$ = undefined;
    this.redirectToLogin();
  }

  private finishLogout(message: string | null): void {
    this.accessToken.set(null);
    this.restore$ = undefined;
    this.sessionMessage.set(message);
    this.clearActivity();
    this.broadcastSessionEnd();
    this.redirectToLogin();
  }

  private redirectToLogin(): void {
    if (!this.router.url.split('?')[0].startsWith('/login')) {
      this.router.navigate(['/login']);
    }
  }

  // --- idle-timestamp + cross-tab plumbing ------------------------------

  private touchActivity(): void {
    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    } catch {
      /* storage unavailable */
    }
  }

  private clearActivity(): void {
    try {
      localStorage.removeItem(LAST_ACTIVITY_KEY);
    } catch {
      /* noop */
    }
  }

  private broadcastSessionEnd(): void {
    try {
      localStorage.setItem(SESSION_EVENT_KEY, JSON.stringify({ type: 'logout', at: Date.now() }));
    } catch {
      /* noop */
    }
  }

  private decode(token: string): JwtPayload | null {
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      return null;
    }
  }
}
