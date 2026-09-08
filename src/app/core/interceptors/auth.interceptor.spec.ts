import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../auth/auth.service';
import { IdleService } from '../services/idle.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let auth: {
    getToken: ReturnType<typeof vi.fn>;
    isAuthenticated: ReturnType<typeof vi.fn>;
    refreshToken: ReturnType<typeof vi.fn>;
    expireSession: ReturnType<typeof vi.fn>;
  };
  let idle: { recordActivity: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    auth = {
      getToken: vi.fn().mockReturnValue('tok1'),
      isAuthenticated: vi.fn().mockReturnValue(true),
      refreshToken: vi.fn(),
      expireSession: vi.fn(),
    };
    idle = { recordActivity: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: IdleService, useValue: idle },
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('attaches the bearer token and records activity on success', () => {
    http.get('/api/tasks').subscribe();
    const req = ctrl.expectOne('/api/tasks');
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok1');
    req.flush({ ok: true });
    expect(idle.recordActivity).toHaveBeenCalled();
  });

  it('on a 401 refreshes once and retries the original request', () => {
    auth.refreshToken.mockReturnValue(of({ success: true, data: { accessToken: 'tok2' } }));
    let result: unknown;
    http.get('/api/tasks').subscribe((r) => (result = r));

    ctrl.expectOne('/api/tasks').flush(null, { status: 401, statusText: 'Unauthorized' });

    const retry = ctrl.expectOne('/api/tasks');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer tok2');
    retry.flush({ ok: true });

    expect(auth.refreshToken).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true });
  });

  it('logs out cleanly when the refresh fails', () => {
    auth.refreshToken.mockReturnValue(throwError(() => new Error('refresh failed')));
    let errored = false;
    http.get('/api/tasks').subscribe({ error: () => (errored = true) });

    ctrl.expectOne('/api/tasks').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(auth.expireSession).toHaveBeenCalled();
    expect(errored).toBe(true);
  });

  it('uses a single shared refresh for concurrent 401s', () => {
    const gate = new Subject<{ success: boolean; data: { accessToken: string } }>();
    auth.refreshToken.mockReturnValue(gate);

    http.get('/api/a').subscribe();
    http.get('/api/b').subscribe();
    ctrl.expectOne('/api/a').flush(null, { status: 401, statusText: 'Unauthorized' });
    ctrl.expectOne('/api/b').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(auth.refreshToken).toHaveBeenCalledTimes(1);

    gate.next({ success: true, data: { accessToken: 'tok2' } });
    gate.complete();

    ctrl.expectOne('/api/a').flush({});
    ctrl.expectOne('/api/b').flush({});
  });

  it('does not try to refresh a failed /auth/ call', () => {
    http.post('/api/auth/login', {}).subscribe({ error: () => {} });
    ctrl.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(auth.refreshToken).not.toHaveBeenCalled();
  });
});
