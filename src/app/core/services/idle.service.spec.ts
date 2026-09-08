import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { IdleService, LAST_ACTIVITY_KEY, SESSION_EVENT_KEY } from './idle.service';
import { AuthService } from '../auth/auth.service';

describe('IdleService', () => {
  let authed: ReturnType<typeof signal<boolean>>;
  let auth: {
    isAuthenticated: () => boolean;
    tokenExpiresInMs: ReturnType<typeof vi.fn>;
    refreshToken: ReturnType<typeof vi.fn>;
    expireSession: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
    followForeignLogout: ReturnType<typeof vi.fn>;
  };
  let idle: IdleService;
  let appRef: ApplicationRef;

  const flush = () => appRef.tick();
  const MIN = 60_000;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-08T10:00:00Z'));

    authed = signal(false);
    auth = {
      isAuthenticated: () => authed(),
      tokenExpiresInMs: vi.fn(() => 12 * MIN),
      refreshToken: vi.fn(() => of({ success: true, data: { accessToken: 'new' } })),
      expireSession: vi.fn(() => authed.set(false)),
      logout: vi.fn(() => authed.set(false)),
      followForeignLogout: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [IdleService, { provide: AuthService, useValue: auth }],
    });
    idle = TestBed.inject(IdleService);
    appRef = TestBed.inject(ApplicationRef);
  });

  afterEach(() => {
    authed.set(false);
    flush();
    vi.useRealTimers();
  });

  function activate() {
    authed.set(true);
    flush(); // runs the auth-state effect -> start()
  }

  it('starts tracking and seeds the activity timestamp when authenticated', () => {
    activate();
    expect(localStorage.getItem(LAST_ACTIVITY_KEY)).toBe(String(Date.now()));
  });

  it('shows the warning after 14 minutes of inactivity', () => {
    activate();
    vi.advanceTimersByTime(14 * MIN + 2_000);
    expect(idle.warningOpen()).toBe(true);
    expect(idle.secondsLeft()).toBeLessThanOrEqual(60);
  });

  it('does not log out while the user is active', () => {
    activate();
    vi.advanceTimersByTime(10 * MIN);
    idle.recordActivity();
    vi.advanceTimersByTime(10 * MIN);
    expect(auth.expireSession).not.toHaveBeenCalled();
    expect(idle.warningOpen()).toBe(false);
  });

  it('logs out after 15 full minutes of inactivity', () => {
    activate();
    vi.advanceTimersByTime(15 * MIN + 2_000);
    expect(auth.expireSession).toHaveBeenCalledWith('Your session expired due to inactivity');
  });

  it('"Stay signed in" resets the timer and refreshes the token', () => {
    activate();
    vi.advanceTimersByTime(14 * MIN + 2_000);
    expect(idle.warningOpen()).toBe(true);

    idle.stayActive();

    expect(idle.warningOpen()).toBe(false);
    expect(auth.refreshToken).toHaveBeenCalled();
    vi.advanceTimersByTime(10 * MIN);
    expect(auth.expireSession).not.toHaveBeenCalled();
  });

  it('throttles activity writes to storage (not once per event)', () => {
    activate();
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    for (let i = 0; i < 40; i++) {
      idle.recordActivity();
      vi.advanceTimersByTime(100); // 4s of rapid activity
    }
    const activityWrites = writes.mock.calls.filter((c) => c[0] === LAST_ACTIVITY_KEY);
    expect(activityWrites.length).toBeLessThanOrEqual(1);
  });

  it('proactively refreshes the JWT for an active user before it expires', () => {
    auth.tokenExpiresInMs.mockReturnValue(2 * MIN);
    activate();
    vi.advanceTimersByTime(11_000);
    expect(auth.refreshToken).toHaveBeenCalled();
  });

  it('stops all timers and listeners on logout', () => {
    activate();
    authed.set(false);
    flush(); // effect -> stop()
    vi.advanceTimersByTime(30 * MIN);
    expect(auth.expireSession).not.toHaveBeenCalled();
  });

  it('isExpiredByStoredActivity reflects the persisted timestamp', () => {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now() - 16 * MIN));
    expect(idle.isExpiredByStoredActivity()).toBe(true);
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now() - 5 * MIN));
    expect(idle.isExpiredByStoredActivity()).toBe(false);
  });

  it('continues the existing idle window after a refresh (does not restart the 15 min)', () => {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now() - 14.5 * MIN));
    activate(); // simulates a page reload restoring the session
    vi.advanceTimersByTime(15_000);
    expect(idle.warningOpen()).toBe(true); // already near expiry, not a fresh 15 min
  });

  it('follows a logout broadcast from another tab', () => {
    activate();
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: SESSION_EVENT_KEY,
        newValue: JSON.stringify({ type: 'logout', at: Date.now() }),
      }),
    );
    expect(auth.followForeignLogout).toHaveBeenCalled();
  });

  it('dismisses its warning when another tab reports fresh activity', () => {
    activate();
    vi.advanceTimersByTime(14 * MIN + 2_000);
    expect(idle.warningOpen()).toBe(true);

    window.dispatchEvent(
      new StorageEvent('storage', { key: LAST_ACTIVITY_KEY, newValue: String(Date.now()) }),
    );
    expect(idle.warningOpen()).toBe(false);
  });
});
