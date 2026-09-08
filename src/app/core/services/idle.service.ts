import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';

/** localStorage keys shared across all TaskFlow tabs on this origin. */
export const LAST_ACTIVITY_KEY = 'tf_last_activity';
export const SESSION_EVENT_KEY = 'tf_session_event';

export const IDLE_TIMEOUT_MS = 15 * 60_000; // hard logout
export const IDLE_WARNING_MS = 14 * 60_000; // show the "1 minute left" dialog
const ACTIVITY_WRITE_THROTTLE_MS = 20_000; // don't touch storage on every mousemove
const CHECK_INTERVAL_MS = 10_000;
const PROACTIVE_REFRESH_MS = 4 * 60_000; // refresh the JWT once it's within this of expiry

const ACTIVITY_EVENTS = [
  'pointermove',
  'pointerdown',
  'mousedown',
  'keydown',
  'wheel',
  'scroll',
  'touchstart',
  'click',
] as const;

/**
 * Global inactivity timeout. Tracks real user activity (throttled), persists the
 * last-activity timestamp so a page refresh continues the *same* idle window, warns
 * at 14 minutes and logs out at 15. Multi-tab aware via `storage` events.
 */
@Injectable({ providedIn: 'root' })
export class IdleService {
  private readonly auth = inject(AuthService);

  readonly warningOpen = signal(false);
  readonly secondsLeft = signal(60);

  private running = false;
  private expiring = false;
  private lastActivityMem = Date.now();
  private lastWriteAt = 0;
  private timerId?: ReturnType<typeof setInterval>;
  private proactiveRefreshInFlight = false;

  private readonly onActivity = () => this.recordActivity();
  private readonly onVisibility = () => {
    if (document.visibilityState === 'visible') this.check();
  };
  private readonly onStorage = (e: StorageEvent) => this.handleStorage(e);

  constructor() {
    // Start/stop tracking in lock-step with the auth state.
    effect(() => {
      if (this.auth.isAuthenticated()) this.start();
      else this.stop();
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** Guard helper — true when the persisted activity timestamp is already stale. */
  isExpiredByStoredActivity(): boolean {
    const ts = this.readStored();
    return ts !== null && Date.now() - ts >= IDLE_TIMEOUT_MS;
  }

  /** Called by the HTTP interceptor on any successful authenticated response. */
  recordActivity(at: number = Date.now()): void {
    if (!this.running || this.warningOpen()) return; // frozen while the dialog is up
    this.lastActivityMem = at;
    if (at - this.lastWriteAt >= ACTIVITY_WRITE_THROTTLE_MS) {
      this.lastWriteAt = at;
      this.writeStored(at);
    }
  }

  /** "Stay signed in" — hard reset of the idle window + a fresh access token. */
  stayActive(): void {
    const now = Date.now();
    this.warningOpen.set(false);
    this.lastActivityMem = now;
    this.lastWriteAt = now;
    this.writeStored(now);
    this.auth.refreshToken().subscribe({ next: () => {}, error: () => {} });
  }

  signOutFromWarning(): void {
    this.warningOpen.set(false);
    this.auth.logout();
  }

  // --- lifecycle -----------------------------------------------------------

  private start(): void {
    if (this.running) return;
    this.running = true;
    this.expiring = false;

    const stored = this.readStored();
    const now = Date.now();
    if (stored !== null && stored <= now) {
      this.lastActivityMem = stored;
      this.lastWriteAt = stored;
    } else {
      this.lastActivityMem = now;
      this.lastWriteAt = now;
      this.writeStored(now);
    }

    for (const type of ACTIVITY_EVENTS) {
      window.addEventListener(type, this.onActivity, { passive: true, capture: true });
    }
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('focus', this.onVisibility);
    window.addEventListener('storage', this.onStorage);

    this.timerId = setInterval(() => this.check(), CHECK_INTERVAL_MS);
    this.check();
  }

  private stop(): void {
    if (!this.running) return;
    this.running = false;
    this.warningOpen.set(false);

    for (const type of ACTIVITY_EVENTS) {
      window.removeEventListener(type, this.onActivity, { capture: true } as EventListenerOptions);
    }
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('focus', this.onVisibility);
    window.removeEventListener('storage', this.onStorage);

    if (this.timerId) clearInterval(this.timerId);
    this.timerId = undefined;
  }

  // --- core check --------------------------------------------------------

  private check(): void {
    if (!this.running || this.expiring) return;

    const last = Math.max(this.lastActivityMem, this.readStored() ?? 0);
    const idleFor = Date.now() - last;

    if (idleFor >= IDLE_TIMEOUT_MS) {
      this.expiring = true;
      this.warningOpen.set(false);
      this.auth.expireSession('Your session expired due to inactivity');
      return;
    }

    if (idleFor >= IDLE_WARNING_MS) {
      this.secondsLeft.set(Math.max(1, Math.ceil((IDLE_TIMEOUT_MS - idleFor) / 1000)));
      if (!this.warningOpen()) this.warningOpen.set(true);
    } else if (this.warningOpen()) {
      // activity (this tab or another) came back in before expiry
      this.warningOpen.set(false);
    } else {
      this.maybeProactiveRefresh(idleFor);
    }
  }

  /** Keep an *active* user's JWT alive without waiting for a 401. */
  private maybeProactiveRefresh(idleFor: number): void {
    if (this.proactiveRefreshInFlight || idleFor >= IDLE_WARNING_MS) return;
    const expiresIn = this.auth.tokenExpiresInMs();
    if (expiresIn > 0 && expiresIn < PROACTIVE_REFRESH_MS) {
      this.proactiveRefreshInFlight = true;
      this.auth.refreshToken().subscribe({
        next: () => (this.proactiveRefreshInFlight = false),
        error: () => (this.proactiveRefreshInFlight = false),
      });
    }
  }

  // --- cross-tab --------------------------------------------------------

  private handleStorage(e: StorageEvent): void {
    if (e.key === LAST_ACTIVITY_KEY && e.newValue) {
      const ts = Number(e.newValue);
      if (Number.isFinite(ts) && ts > this.lastActivityMem) {
        this.lastActivityMem = ts;
        this.check(); // may dismiss our warning if another tab is active
      }
      return;
    }
    if (e.key === SESSION_EVENT_KEY && e.newValue) {
      // Another tab logged out or expired — follow it.
      this.warningOpen.set(false);
      this.auth.followForeignLogout();
    }
  }

  // --- storage helpers -------------------------------------------------

  private readStored(): number | null {
    try {
      const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
      if (!raw) return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }

  private writeStored(ts: number): void {
    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(ts));
    } catch {
      /* private mode / disabled storage — fall back to in-memory only */
    }
  }
}
